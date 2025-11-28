import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Power,
  Activity,
  Navigation,
  Radio,
  Dot,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const RealtimeCommand = () => {
 

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const riderId = searchParams.get("riderId");
  // ❌ REMOVED: const fileId = searchParams.get("fileId");
  const riderName = searchParams.get("riderName") || "Unknown Rider";

  const { toast } = useToast();

  const [isActive, setIsActive] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  
  // ✅ ADDED: State to store file_id fetched from database
  const [fileId, setFileId] = useState<string | null>(null);
  const [isLoadingFileId, setIsLoadingFileId] = useState(true);

  // IMU
  const [imuData, setImuData] = useState({
    ax: 0,
    ay: 0,
    az: 0,
    gx: 0,
    gy: 0,
    gz: 0,
  });

  // GPS
  const [gpsData, setGpsData] = useState({
    latitude: null as number | null,
    longitude: null as number | null,
    speed: 0,
  });

  // Potholes
  const [potholes, setPotholes] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [loadingPotholes, setLoadingPotholes] = useState(false);

  // Ride Events
  const [events, setEvents] = useState<any[]>([]);
  const [eventSortOrder, setEventSortOrder] = useState<"newest" | "oldest">(
    "newest"
  );
  const [loadingEvents, setLoadingEvents] = useState(false);

  // =======================================================================
  // ✅ ADDED: Auto-fetch latest file_id for this rider
  // =======================================================================
  useEffect(() => {
    if (!riderId) return;

    const fetchLatestFileId = async () => {
      setIsLoadingFileId(true);

      console.log("🔍 Fetching latest file_id for rider:", riderId);

      const { data, error } = await supabase
        .from("riderfiles")
        .select("id")
        .eq("rider_id", riderId)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("❌ Error fetching file_id:", error);
        toast({
          title: "Error",
          description: "Could not fetch active ride session",
          variant: "destructive",
        });
        setIsLoadingFileId(false);
        return;
      }

      if (data) {
        console.log("✅ Latest file_id found:", data.id);
        setFileId(data.id);
        

      } else {
        console.warn("⚠️ No file found for rider");
      }

      setIsLoadingFileId(false);
    };

    fetchLatestFileId();
  }, [riderId]);

  // =======================================================================
  // REALTIME RIDERDATA SUB (No changes needed - already works)
  // =======================================================================
  useEffect(() => {
    if (!riderId) return;

    const channel = supabase
      .channel(`riderdata-${riderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "riderdata",
          filter: `rider_id=eq.${riderId}`,
        },
        (payload) => {
          const d = payload.new;

          setImuData({
            ax: Number(d.ax) || 0,
            ay: Number(d.ay) || 0,
            az: Number(d.az) || 0,
            gx: Number(d.gx) || 0,
            gy: Number(d.gy) || 0,
            gz: Number(d.gz) || 0,
          });

          setGpsData({
            latitude: d.gps_lat ? parseFloat(d.gps_lat) : null,
            longitude: d.gps_lon ? parseFloat(d.gps_lon) : null,
            speed: d.gps_speed_kn ? Number(d.gps_speed_kn) * 1.852 : 0,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId]);

  // =======================================================================
  // FETCH INITIAL POTHOLES
  // ✅ CHANGED: Added isLoadingFileId check
  // =======================================================================
  useEffect(() => {
    // ✅ ADDED: Don't run if still loading fileId
    if (!riderId || !fileId || isLoadingFileId) return;

    const load = async () => {
      setLoadingPotholes(true);

      // ✅ ADDED: Debug log
      console.log("🕳️ Fetching potholes for rider:", riderId, "file:", fileId);

      const { data, error } = await supabase
        .from("pothole_events")
        .select("*")
        .eq("rider_id", riderId)
        .eq("file_id", fileId)
        .order("detected_at", {
          ascending: sortOrder === "oldest",
        });

      // ✅ ADDED: Error handling
      if (error) {
        console.error("❌ Error fetching potholes:", error);
      } else {
        console.log("✅ Potholes fetched:", data?.length || 0);
        setPotholes(data || []);
      }

      setLoadingPotholes(false);
    };

    load();
  }, [riderId, fileId, sortOrder, isLoadingFileId]); // ✅ ADDED: isLoadingFileId dependency

  // =======================================================================
  // REALTIME POTHOLE SUB
  // ✅ CHANGED: Added isLoadingFileId check and debug logs
  // =======================================================================
  useEffect(() => {
    // ✅ ADDED: Don't run if still loading fileId
    if (!riderId || !fileId || isLoadingFileId) return;

    // ✅ ADDED: Debug log
    console.log("🔔 Setting up realtime subscription for potholes");

    const channel = supabase
      .channel(`pothole-${riderId}-${fileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pothole_events",
          filter: `rider_id=eq.${riderId},file_id=eq.${fileId}`,
        },
        (payload) => {
          const e = payload.new;
          console.log(
            "%c[POTHOLE] New pothole detected!",
            "color:#ff6600; font-weight:bold; font-size:14px;",
            e
          );

          // ✅ ADDED: Warning if file_id mismatch
          if (e.file_id !== fileId) {
            console.warn("⚠️ Pothole file_id mismatch, ignoring");
            return;
          }

          setPotholes((prev) => {
            const merged = [e, ...prev];

            console.log(
              "%c[POTHOLE] Total potholes after merge:",
              "color:#ffaa00; font-weight:bold;",
              merged.length
            );

            merged.sort((a, b) => {
              const diff =
                new Date(b.detected_at).getTime() -
                new Date(a.detected_at).getTime();
              return diff;
            });
            return merged;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId, fileId, sortOrder, isLoadingFileId]); // ✅ ADDED: isLoadingFileId dependency

  // =======================================================================
  // FETCH INITIAL RIDE EVENTS
  // ✅ CHANGED: Added isLoadingFileId check
  // =======================================================================
  useEffect(() => {
    // ✅ ADDED: Don't run if still loading fileId
    if (!riderId || !fileId || isLoadingFileId) return;

    const load = async () => {
      setLoadingEvents(true);

      // ✅ ADDED: Debug log
      console.log("🎯 Fetching ride events for rider:", riderId, "file:", fileId);

      const { data, error } = await supabase
        .from("ride_events")
        .select("*")
        .eq("rider_id", riderId)
        .eq("file_id", fileId)
        .order("start_time", {
          ascending: eventSortOrder === "oldest",
        });

      // ✅ ADDED: Error handling
      if (error) {
        console.error("❌ Error fetching events:", error);
      } else {
        console.log("✅ Events fetched:", data?.length || 0);
        setEvents(data || []);
      }

      setLoadingEvents(false);
    };

    load();
  }, [riderId, fileId, eventSortOrder, isLoadingFileId]); // ✅ ADDED: isLoadingFileId dependency

  // =======================================================================
  // REALTIME RIDE EVENTS
  // ✅ CHANGED: Added isLoadingFileId check and debug log
  // =======================================================================
  useEffect(() => {
    // ✅ ADDED: Don't run if still loading fileId
    if (!riderId || !fileId || isLoadingFileId) return;

    // ✅ ADDED: Debug log
    console.log("🔔 Setting up realtime subscription for ride events");

    const channel = supabase
      .channel(`ride-events-${riderId}-${fileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_events",
          filter: `rider_id=eq.${riderId},file_id=eq.${fileId}`,
        },
        (payload) => {
          const ev = payload.new;
          console.log(
            "%c[EVENT] New ride event arrived!",
            "color:#33bbff; font-weight:bold; font-size:14px;",
            ev
          );

          setEvents((prev) => {
            const merged = [ev, ...prev];
            console.log(
              "%c[EVENT] Total events after merge:",
              "color:#55ddff; font-weight:bold;",
              merged.length
            );

            merged.sort((a, b) => {
              const diff =
                new Date(b.start_time).getTime() -
                new Date(a.start_time).getTime();
              return diff;
            });

            return merged;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId, fileId, eventSortOrder, isLoadingFileId]); // ✅ ADDED: isLoadingFileId dependency

  // =======================================================================
  // STOP RIDER (No changes needed)
  // =======================================================================
  const handleStopRider = async () => {
    setIsStopping(true);

    await supabase.from("rider_commands").insert({
      rider_id: riderId,
      command: "stop",
      status: "pending",
    });

    toast({
      title: "Ride Stopped",
      description: "Raspberry Pi will stop collecting data",
    });

    setTimeout(() => {
      navigate(`/dashboard?riderId=${riderId}`);
    }, 1500);
  };

  // =======================================================================
  // ✅ ADDED: Loading State UI
  // =======================================================================
  if (isLoadingFileId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading ride session...</p>
        </div>
      </div>
    );
  }

  // ✅ ADDED: Error State UI (no file_id found)
  if (!fileId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-semibold mb-2">
            ❌ No active ride session found
          </p>
          <p className="text-muted-foreground mb-4">
            Please start a new ride from the dashboard
          </p>
          <Button onClick={() => navigate(`/dashboard?riderId=${riderId}`)}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // =======================================================================
  // UI BELOW (No changes needed)
  // =======================================================================

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/dashboard?riderId=${riderId}`)}
            disabled={isStopping}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{riderName}</h1>
            <p className="text-muted-foreground">
              File: {fileId?.slice(0, 8)}...
            </p>
          </div>
        </div>

        <Badge variant={isActive ? "default" : "destructive"}>
          {isActive ? "ACTIVE" : "STOPPED"}
        </Badge>
      </div>

      {/* STOP BUTTON */}
      <Card className="border-destructive/50 mb-10">
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Power className="w-5 h-5" />
            Rider Control
          </CardTitle>
          <CardDescription>Stop data collection instantly</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={isStopping}
            onClick={handleStopRider}
          >
            {isStopping ? "Stopping..." : "STOP RIDER"}
          </Button>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* POTHOLES */}
        <Card>
          <CardHeader>
            <CardTitle>Potholes (Recent 5)</CardTitle>
            <CardDescription>Detected by threshold model</CardDescription>
          </CardHeader>

          <CardContent>
            {loadingPotholes ? (
              <p>Loading...</p>
            ) : potholes.length === 0 ? (
              <p>No potholes detected.</p>
            ) : (
              <ul className="space-y-3">
                {potholes
                  .slice(0, 5)
                  .map((p) => (
                    <li
                      key={p.id}
                      className="p-3 bg-muted rounded-md flex justify-between"
                    >
                      <div className="font-mono">
                       {p.detected_at.replace("T", " ").split(".")[0]}

                      </div>
                      <span className="text-xs text-muted-foreground">
                        {p.id.slice(0, 8)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* RIDE EVENTS */}
        <Card>
          <CardHeader>
            <CardTitle>Ride Events (Recent 5)</CardTitle>
            <CardDescription>LSTM model detections</CardDescription>
          </CardHeader>

          <CardContent>
            {loadingEvents ? (
              <p>Loading...</p>
            ) : events.length === 0 ? (
              <p>No ride events detected.</p>
            ) : (
              <ul className="space-y-3">
                {events
                  .slice(0, 5)
                  .map((ev) => (
                    <li
                      key={ev.id}
                      className="p-3 bg-muted rounded-md flex justify-between"
                    >
                      <div>
                        <div className="font-semibold">{ev.event_type}</div>
                        <div className="text-xs">
                          {ev.start_time.replace("T", " ").split(".")[0]} → {ev.end_time.replace("T", " ").split(".")[0]}

                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ev.confidence_percent}% – {ev.duration_seconds}s
                        </div>
                      </div>

                      <span className="text-xs text-muted-foreground">
                        {ev.id.slice(0, 8)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {/* SENSOR GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* IMU */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" /> IMU Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {["ax", "ay", "az"].map((axis) => (
                <div key={axis} className="bg-muted p-4 rounded-md">
                  <div className="text-xs text-muted-foreground">{axis}</div>
                  <div className="text-2xl font-mono font-bold">
                    {imuData[axis as keyof typeof imuData].toFixed(3)}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              {["gx", "gy", "gz"].map((axis) => (
                <div key={axis} className="bg-muted p-4 rounded-md">
                  <div className="text-xs text-muted-foreground">{axis}</div>
                  <div className="text-2xl font-mono font-bold">
                    {imuData[axis as keyof typeof imuData].toFixed(3)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* GPS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" /> GPS Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-muted p-4 rounded-md">
                <div className="text-xs">Latitude</div>
                <div className="text-xl font-mono font-bold">
                  {gpsData.latitude?.toFixed(6) ?? "N/A"}
                </div>
              </div>
              <div className="bg-muted p-4 rounded-md">
                <div className="text-xs">Longitude</div>
                <div className="text-xl font-mono font-bold">
                  {gpsData.longitude?.toFixed(6) ?? "N/A"}
                </div>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-md">
              <div className="text-xs">Speed (km/h)</div>
              <div className="text-3xl font-mono font-bold text-center">
                {gpsData.speed.toFixed(1)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      
    </div>
  );
};

export default RealtimeCommand;