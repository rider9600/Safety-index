import { useState, useEffect } from "react";
import AccelerometerChart from "@/components/charts/AccelerometerChart";
import GpsChart from "@/components/charts/GpsChart";
import SpeedChart1 from "@/components/charts/Gps-speedchart";
import GyroscopeChart from "@/components/charts/GyroscopeChart";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/layout/Navigation";
import SafetyGauge from "@/components/dashboard/SafetyGauge";
import MetricCard from "@/components/dashboard/MetricCard";
import SpeedChart from "@/components/charts/SpeedChart";
import EventsChart from "@/components/charts/EventsChart";
import SafetyTrendChart from "@/components/charts/SafetyTrendChart";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Gauge,
  AlertTriangle,
  Navigation as NavIcon,
  Moon,
  Radio,
  FileUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const riderId = searchParams.get("riderId");

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [availableFiles, setAvailableFiles] = useState<
    Array<{ id: string; name: string; uploadTime: string }>
  >([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isStartingRide, setIsStartingRide] = useState(false);

  const [speedData, setSpeedData] = useState<any[]>([]);
  const [eventData, setEventData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [riderName, setRiderName] = useState("");

  const [axData, setAxData] = useState<any[]>([]);
  const [ayData, setAyData] = useState<any[]>([]);
  const [azData, setAzData] = useState<any[]>([]);
  const [gxData, setGxData] = useState<any[]>([]);
  const [gyData, setGyData] = useState<any[]>([]);
  const [gzData, setGzData] = useState<any[]>([]);
  const [gpsData, setGpsData] = useState<any[]>([]);

  useEffect(() => {
    if (!riderId) return;

    const fetchRiderName = async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("name")
        .eq("id", riderId)
        .single();

      if (!error && data) setRiderName(data.name);
    };

    fetchRiderName();
  }, [riderId]);

  useEffect(() => {
    if (!riderId) return;
    fetchAvailableFiles();
  }, [riderId]);

  const processEventData = (riderData: any[]) => {
    const dailyEvents = {};
    riderData.forEach((reading) => {
      const date = new Date(reading.timestamp).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      });
      if (!dailyEvents[date])
        dailyEvents[date] = {
          overspeed: 0,
          harshBraking: 0,
          swerving: 0,
          nightRides: 0,
        };
      const speed = reading.gps_speed_kn
        ? parseFloat(reading.gps_speed_kn) * 1.852
        : 0;
      if (speed > 50) dailyEvents[date].overspeed++;
      if (reading.ax !== undefined && parseFloat(reading.ax) < -3)
        dailyEvents[date].harshBraking++;
      if (reading.ay !== undefined && Math.abs(parseFloat(reading.ay)) > 2)
        dailyEvents[date].swerving++;
      const hour = new Date(reading.timestamp).getHours();
      if (hour < 6 || hour > 22) dailyEvents[date].nightRides++;
    });
    return Object.entries(dailyEvents).map(([date, events]) => ({
      date,
      ...events,
    }));
  };

  const calculateSafetyTrends = (riderData: any[]) => {
    const dailyScores = {};
    riderData.forEach((reading) => {
      const date = new Date(reading.timestamp).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      });
      if (!dailyScores[date]) {
        dailyScores[date] = { scores: [], target: 80 };
      }
      let score = 100;
      const speed = reading.gps_speed_kn
        ? parseFloat(reading.gps_speed_kn) * 1.852
        : 0;
      if (speed > 50) score -= 15;
      if (reading.ax !== undefined && Math.abs(parseFloat(reading.ax)) > 2)
        score -= 10;
      if (reading.ay !== undefined && Math.abs(parseFloat(reading.ay)) > 2)
        score -= 10;
      dailyScores[date].scores.push(Math.max(0, score));
    });
    return Object.entries(dailyScores).map(([date, data]) => ({
      date,
      safetyScore: Math.round(
        data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      ),
      target: 80,
    }));
  };

  const fetchAvailableFiles = async () => {
    if (!riderId) return;
    try {
      setIsLoadingFiles(true);

      const { data: files, error } = await supabase
        .from("riderfiles")
        .select("id, filename, uploaded_at")
        .eq("rider_id", riderId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      if (!files || files.length === 0) {
        toast({
          title: "No files found",
          description: "No files for this rider.",
        });
        setAvailableFiles([]);
        return;
      }

      const formattedFiles = files.map((f) => ({
        id: f.id,
        name: f.filename || "Unnamed File",
        uploadTime: f.uploaded_at,
      }));

      setAvailableFiles(formattedFiles);
    } catch (err) {
      toast({
        title: "Error fetching files",
        description: (err as any).message || "Unknown error",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const fetchFileData = async (fileId: string) => {
    if (!riderId) return;
    try {
      setIsLoadingData(true);

      const { data: fileData, error: dataError } = await supabase
        .from("riderdata")
        .select("*")
        .eq("rider_id", riderId)
        .eq("file_id", fileId)
        .order("timestamp", { ascending: true });

      if (dataError) throw dataError;

      if (!fileData || fileData.length === 0) {
        toast({
          title: "No data found",
          description: "This file has no associated sensor data.",
        });
        setSpeedData([]);
        setEventData([]);
        setTrendData([]);
        setAxData([]);
        setAyData([]);
        setAzData([]);
        setGxData([]);
        setGyData([]);
        setGzData([]);
        return;
      }

      const speedData = fileData.map((r: any) => ({
        time: new Date(r.timestamp).toLocaleTimeString(),
        speed: r.gps_speed_kn ? parseFloat(r.gps_speed_kn) * 1.852 : 0,
        speedLimit: 50,
        overspeed:
          (r.gps_speed_kn ? parseFloat(r.gps_speed_kn) * 1.852 : 0) > 50,
      }));

      setSpeedData(speedData);
      setAxData(fileData.map((r) => ({ time: r.timestamp, value: parseFloat(r.ax) || 0 })));
      setAyData(fileData.map((r) => ({ time: r.timestamp, value: parseFloat(r.ay) || 0 })));
      setAzData(fileData.map((r) => ({ time: r.timestamp, value: parseFloat(r.az) || 0 })));
      setGxData(fileData.map((r) => ({ time: r.timestamp, value: parseFloat(r.gx) || 0 })));
      setGyData(fileData.map((r) => ({ time: r.timestamp, value: parseFloat(r.gy) || 0 })));
      setGzData(fileData.map((r) => ({ time: r.timestamp, value: parseFloat(r.gz) || 0 })));
      setEventData(processEventData(fileData));
      setTrendData(calculateSafetyTrends(fileData));

      const filename = availableFiles.find((f) => f.id === fileId)?.name || "Unknown File";
      setSelectedFileName(filename);

      toast({ title: "Data loaded successfully", description: filename });
    } catch (err) {
      console.error("Error fetching rider data:", err);
      toast({ title: "Failed to load data", description: "Try again later." });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleStartRide = async () => {
    if (!riderId) {
      toast({
        title: "Error",
        description: "Rider ID not found",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsStartingRide(true);

      // Insert START command into rider_commands table
      const { data: commandData, error: commandError } = await supabase
        .from("rider_commands")
        .insert({
          rider_id: riderId,
          command: "start",
          status: "pending",
        })
        .select()
        .single();

      if (commandError) throw commandError;

      toast({
        title: "Ride started",
        description: `Data collection started for ${riderName}`,
      });

      // Navigate to realtime command page
      navigate(`/realtime-command?riderId=${riderId}&riderName=${riderName}`);
    } catch (err) {
      console.error("Error starting ride:", err);
      toast({
        title: "Failed to start ride",
        description: (err as any).message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsStartingRide(false);
    }
  };

  const recentAxData = axData.slice(-50);
  const recentAyData = ayData.slice(-50);
  const recentAzData = azData.slice(-50);
  const recentGxData = gxData.slice(-50);
  const recentGyData = gyData.slice(-50);
  const recentGzData = gzData.slice(-50);

  const latestAx = recentAxData[recentAxData.length - 1]?.value || 0;
  const latestAy = recentAyData[recentAyData.length - 1]?.value || 0;
  const latestAz = recentAzData[recentAzData.length - 1]?.value || 0;
  const latestGx = recentGxData[recentGxData.length - 1]?.value || 0;
  const latestGy = recentGyData[recentGyData.length - 1]?.value || 0;
  const latestGz = recentGzData[recentGzData.length - 1]?.value || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-6 pb-8 pt-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">
              Fleet Safety Dashboard
            </h1>
            <p className="text-muted-foreground mb-2">
              {selectedFileName ? `${riderName}: ${selectedFileName}` : `Real-time monitoring`}
            </p>
            {!selectedFileName && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <FileUp className="w-4 h-4" />
                Select any file to view data or start new ride
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Select
                value={selectedFileId ?? ""}
                onOpenChange={(open) => {
                  if (open && availableFiles.length === 0 && !isLoadingFiles)
                    fetchAvailableFiles();
                }}
                onValueChange={(val) => {
                  setSelectedFileId(val);
                  fetchFileData(val);
                }}
                disabled={isLoadingFiles}
              >
                <SelectTrigger className="min-w-[220px]">
                  <SelectValue
                    placeholder={isLoadingFiles ? "Loading files..." : "Choose file from backend"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableFiles.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleStartRide}
                size="lg"
                className="gap-2"
                disabled={isStartingRide}
              >
                <Radio className="w-5 h-5" />
                {isStartingRide ? "Starting..." : "Start Command"}
              </Button>
            </div>
          </div>
        </div>

        {selectedFileName && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* <SafetyGauge score={82} />
              <EventsChart data={eventData} showPieChart />
              <SafetyTrendChart data={trendData} /> */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* <MetricCard
                    title="Overspeed Events"
                    value={4}
                    unit="events"
                    icon={Gauge}
                    trend={-15}
                    color="events"
                    description="Speed limit violations detected"
                  /> */}
                  {/* <MetricCard
                    title="Harsh Braking"
                    value={2}
                    unit="events"
                    icon={AlertTriangle}
                    trend={-25}
                    color="braking"
                    description="Sudden deceleration events"
                  /> */}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* <MetricCard
                    title="Swerving"
                    value={1}
                    unit="events"
                    icon={NavIcon}
                    trend={-50}
                    color="swerving"
                    description="Sharp steering maneuvers"
                  /> */}
                  {/* <MetricCard
                    title="Night Rides"
                    value={0}
                    unit="trips"
                    icon={Moon}
                    trend={0}
                    color="night"
                    description="Trips during night hours"
                  /> */}
                  {/* <MetricCard
                    title="Accelerometer"
                    value={latestAx}
                    unit="m/s²"
                    icon={Gauge}
                    color="speed"
                    description={
                      <div>
                        AX: {latestAx.toFixed(2)} <br />
                        AY: {latestAy.toFixed(2)} <br />
                        AZ: {latestAz.toFixed(2)}
                      </div>
                    }
                  /> */}
                  {/* <MetricCard
                    title="Gyroscope"
                    value={latestGx}
                    unit="°/s"
                    icon={NavIcon}
                    color="events"
                    description={
                      <div>
                        GX: {latestGx.toFixed(2)} <br />
                        GY: {latestGy.toFixed(2)} <br />
                        GZ: {latestGz.toFixed(2)}
                      </div>
                    }
                  /> */}
                </div>
              </div>

              {/* <div className="space-y-6">
                <SpeedChart data={speedData} />
              </div> */}
            </div>

            <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
              <AccelerometerChart
                data={axData.map((d, i) => ({
                  time: new Date(d.time).toLocaleTimeString(),
                  ax: d.value,
                  ay: ayData[i]?.value ?? 0,
                  az: azData[i]?.value ?? 0,
                }))}
                title="Accelerometer Data (AX, AY, AZ)"
              />
              <GyroscopeChart
                data={gxData.map((d, i) => ({
                  time: new Date(d.time).toLocaleTimeString(),
                  gx: d.value,
                  gy: gyData[i]?.value ?? 0,
                  gz: gzData[i]?.value ?? 0,
                }))}
                title="Gyroscope Data (GX, GY, GZ)"
              />
            </div>
            {/* <div className="space-y-6">
                <SpeedChart data={speedData} />
              </div> */}
              <SpeedChart1 data={speedData} />
            <div className="grid grid-cols-2 gap-4">
                  {/* <MetricCard
                    title="Swerving"
                    value={1}
                    unit="events"
                    icon={NavIcon}
                    trend={-50}
                    color="swerving"
                    description="Sharp steering maneuvers"
                  /> */}
                  {/* <MetricCard
                    title="Night Rides"
                    value={0}
                    unit="trips"
                    icon={Moon}
                    trend={0}
                    color="night"
                    description="Trips during night hours"
                  /> */}
                  <MetricCard
                    title="Accelerometer"
                    value={latestAx}
                    unit="m/s²"
                    icon={Gauge}
                    color="speed"
                    description={
                      <div>
                        AX: {latestAx.toFixed(2)} <br />
                        AY: {latestAy.toFixed(2)} <br />
                        AZ: {latestAz.toFixed(2)}
                      </div>
                    }
                  /> 
                   <MetricCard
                    title="Gyroscope"
                    value={latestGx}
                    unit="°/s"
                    icon={NavIcon}
                    color="events"
                    description={
                      <div>
                        GX: {latestGx.toFixed(2)} <br />
                        GY: {latestGy.toFixed(2)} <br />
                        GZ: {latestGz.toFixed(2)}
                      </div>
                    }
                  /> 
                </div>
            {/* <GpsChart data={gpsData} /> */}
            {/* <SpeedChart1 data={speedData} /> */}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;