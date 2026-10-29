import {
  ArrowUp,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Gauge,
  MapPin,
  Navigation,
  Search,
  Sun,
  Wind,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type WeatherKind = "sun" | "partly" | "cloud" | "rain" | "storm" | "snow" | "fog";
type ForecastDay = { day: string; kind: WeatherKind; high: number; low: number };
type HourForecast = { time: string; kind: WeatherKind; temperature: number };
type WeatherData = {
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  kind: WeatherKind;
  high: number;
  low: number;
  humidity: number;
  wind: number;
  pressure: number;
  aqi: number;
  forecast: ForecastDay[];
  hourly: HourForecast[];
  demo?: boolean;
};

type GeoResult = { name: string; country: string; latitude: number; longitude: number };
type WeatherResponse = {
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; surface_pressure: number; weather_code: number };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] };
};
type AirResponse = { current: { us_aqi: number } };

const quickCities = ["London", "New York", "Tokyo", "Copenhagen"];
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hourLabels = ["Now", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM"];

function getKind(code: number): WeatherKind {
  if (code === 0) return "sun";
  if (code <= 2) return "partly";
  if (code <= 48) return "fog";
  if (code <= 67 || (code >= 80 && code <= 82)) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}

function getCondition(kind: WeatherKind) {
  return ({ sun: "Clear sky", partly: "Partly cloudy", cloud: "Overcast", rain: "Light rain", storm: "Thunderstorms", snow: "Snow showers", fog: "Misty" })[kind];
}

function WeatherIcon({ kind, className = "" }: { kind: WeatherKind; className?: string }) {
  const iconProps = { className, strokeWidth: 1.6 };
  if (kind === "sun") return <Sun {...iconProps} />;
  if (kind === "partly") return <CloudSun {...iconProps} />;
  if (kind === "rain") return <CloudRain {...iconProps} />;
  if (kind === "storm") return <CloudLightning {...iconProps} />;
  if (kind === "snow") return <CloudSnow {...iconProps} />;
  if (kind === "fog") return <CloudFog {...iconProps} />;
  return <Cloud {...iconProps} />;
}

function makeDemoWeather(cityInput: string): WeatherData {
  const normalized = cityInput.trim().toLowerCase();
  const known: Record<string, Omit<WeatherData, "forecast" | "hourly" | "demo">> = {
    london: { city: "London", country: "United Kingdom", temperature: 18, feelsLike: 17, condition: "Partly cloudy", kind: "partly", high: 20, low: 13, humidity: 64, wind: 12, pressure: 1016, aqi: 24 },
    "new york": { city: "New York", country: "United States", temperature: 24, feelsLike: 25, condition: "Mostly sunny", kind: "sun", high: 27, low: 19, humidity: 48, wind: 9, pressure: 1013, aqi: 42 },
    tokyo: { city: "Tokyo", country: "Japan", temperature: 22, feelsLike: 23, condition: "Light rain", kind: "rain", high: 24, low: 18, humidity: 76, wind: 7, pressure: 1010, aqi: 56 },
    copenhagen: { city: "Copenhagen", country: "Denmark", temperature: 16, feelsLike: 15, condition: "Clear sky", kind: "sun", high: 18, low: 12, humidity: 56, wind: 15, pressure: 1019, aqi: 18 },
  };
  const base = known[normalized] ?? (() => {
    const seed = [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const temp = 14 + (seed % 15);
    return {
      city: cityInput.trim().replace(/\b\w/g, (letter) => letter.toUpperCase()),
      country: "Local forecast",
      temperature: temp,
      feelsLike: temp - 1,
      condition: seed % 3 === 0 ? "Partly cloudy" : seed % 3 === 1 ? "Clear sky" : "Light rain",
      kind: (seed % 3 === 0 ? "partly" : seed % 3 === 1 ? "sun" : "rain") as WeatherKind,
      high: temp + 3,
      low: temp - 5,
      humidity: 42 + (seed % 44),
      wind: 5 + (seed % 18),
      pressure: 1008 + (seed % 19),
      aqi: 18 + (seed % 95),
    };
  })();
  const today = new Date().getDay();
  const forecast: ForecastDay[] = ["partly", "sun", "rain", "cloud", "partly"].map((kind, index) => ({
    day: weekdays[(today + index) % 7],
    kind: (index === 0 ? base.kind : kind) as WeatherKind,
    high: base.high + [0, 1, -2, -1, 2][index],
    low: base.low + [0, 1, 0, -2, 1][index],
  }));
  const hourly: HourForecast[] = hourLabels.map((time, index) => ({
    time,
    kind: ([base.kind, "partly", "sun", "sun", "partly", "cloud"][index]) as WeatherKind,
    temperature: base.temperature + [0, 1, 2, 3, 2, 1][index],
  }));
  return { ...base, forecast, hourly, demo: true };
}

function getAqiInfo(aqi: number) {
  if (aqi <= 50) return { label: "Good", color: "text-emerald-300", bar: "bg-emerald-400", note: "Air quality is ideal for outdoor activities." };
  if (aqi <= 100) return { label: "Moderate", color: "text-amber-300", bar: "bg-amber-400", note: "Sensitive groups may want to limit prolonged outdoor exertion." };
  if (aqi <= 150) return { label: "Unhealthy for some", color: "text-orange-300", bar: "bg-orange-400", note: "Consider reducing prolonged outdoor activity." };
  return { label: "Unhealthy", color: "text-rose-300", bar: "bg-rose-400", note: "Limit time outdoors and keep windows closed." };
}

async function fetchWeather(city: string): Promise<WeatherData> {
  const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  if (!geoResponse.ok) throw new Error("Location lookup unavailable");
  const geo = (await geoResponse.json()) as { results?: GeoResult[] };
  const place = geo.results?.[0];
  if (!place) throw new Error("City not found");
  const params = `latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,surface_pressure,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`;
  const [weatherResponse, airResponse] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.latitude}&longitude=${place.longitude}&current=us_aqi&timezone=auto`),
  ]);
  if (!weatherResponse.ok) throw new Error("Forecast unavailable");
  const weather = (await weatherResponse.json()) as WeatherResponse;
  const air = airResponse.ok ? ((await airResponse.json()) as AirResponse) : null;
  const currentKind = getKind(weather.current.weather_code);
  const forecast = weather.daily.time.map((date, index) => ({
    day: index === 0 ? "Today" : weekdays[new Date(`${date}T12:00:00`).getDay()],
    kind: getKind(weather.daily.weather_code[index]),
    high: Math.round(weather.daily.temperature_2m_max[index]),
    low: Math.round(weather.daily.temperature_2m_min[index]),
  }));
  const hourIndices = weather.hourly.time.map((time, index) => ({ time, index })).filter(({ time }) => new Date(time).getDate() === new Date().getDate()).slice(0, 6);
  const hourly = hourIndices.map(({ time, index }, position) => ({
    time: position === 0 ? "Now" : new Date(time).toLocaleTimeString("en", { hour: "numeric", hour12: true }),
    kind: getKind(weather.hourly.weather_code[index]),
    temperature: Math.round(weather.hourly.temperature_2m[index]),
  }));
  return {
    city: place.name,
    country: place.country,
    temperature: Math.round(weather.current.temperature_2m),
    feelsLike: Math.round(weather.current.apparent_temperature),
    condition: getCondition(currentKind),
    kind: currentKind,
    high: Math.round(weather.daily.temperature_2m_max[0]),
    low: Math.round(weather.daily.temperature_2m_min[0]),
    humidity: weather.current.relative_humidity_2m,
    wind: Math.round(weather.current.wind_speed_10m),
    pressure: Math.round(weather.current.surface_pressure),
    aqi: air?.current.us_aqi ?? 42,
    forecast,
    hourly,
  };
}

export default function Index() {
  const [weather, setWeather] = useState(() => makeDemoWeather("London"));
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState<"C" | "F">("C");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    document.title = "SkyCast — Your weather, at a glance";
  }, []);

  const formatTemp = (temperature: number) => `${unit === "C" ? temperature : Math.round(temperature * 9 / 5 + 32)}°`;
  const searchCity = async (city: string) => {
    const trimmed = city.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setNotice("");
    setQuery(trimmed);
    try {
      const result = await fetchWeather(trimmed);
      setWeather(result);
    } catch {
      setWeather(makeDemoWeather(trimmed));
      setNotice("Showing a sample forecast for your search");
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void searchCity(query);
  };
  const aqi = getAqiInfo(weather.aqi);

  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 top-12 h-[26rem] w-[26rem] rounded-full bg-sky-200/25 blur-3xl" />
        <div className="absolute -right-40 top-[28rem] h-[30rem] w-[30rem] rounded-full bg-indigo-100/40 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-[1240px] px-5 pb-10 pt-6 sm:px-8 sm:pt-8 lg:px-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[15px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/20">
              <CloudSun size={25} strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[19px] font-bold tracking-[-0.04em] text-slate-900">skycast<span className="text-sky-500">.</span></div>
              <div className="-mt-0.5 text-[11px] font-medium tracking-wide text-slate-400">WEATHER, WITH CLARITY</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-2 text-xs font-medium text-slate-500 shadow-sm sm:flex">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              Updated just now
            </div>
            <div className="flex items-center rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-sm" aria-label="Temperature unit">
              <button onClick={() => setUnit("C")} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${unit === "C" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`} aria-pressed={unit === "C"}>°C</button>
              <button onClick={() => setUnit("F")} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${unit === "F" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`} aria-pressed={unit === "F"}>°F</button>
            </div>
          </div>
        </header>

        <section className="mt-10 flex flex-col gap-5 md:mt-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Your personal weather desk</p>
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.055em] text-slate-900 sm:text-[40px]">A little more in tune <span className="text-slate-400">with today.</span></h1>
            <p className="mt-2 text-sm text-slate-500">Everything happening outside, all in one place.</p>
          </div>
          <form onSubmit={handleSubmit} className="flex w-full max-w-[390px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 pl-4 shadow-[0_8px_24px_rgba(37,67,109,0.06)] transition focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-100 md:mb-1">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search any city..." aria-label="Search city" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
            <button type="submit" disabled={loading || !query.trim()} aria-label="Search weather" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white transition hover:bg-sky-600 disabled:cursor-wait disabled:opacity-60">{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Navigation size={16} fill="currentColor" />}</button>
          </form>
        </section>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <span className="mr-1 text-xs font-medium text-slate-400">Popular</span>
          {quickCities.map((city) => (
            <button key={city} onClick={() => void searchCity(city)} disabled={loading} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${weather.city.toLowerCase() === city.toLowerCase() ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200/80 bg-white/70 text-slate-500 hover:border-sky-200 hover:bg-white hover:text-sky-700"}`}>{city}</button>
          ))}
          {notice && <span role="status" className="ml-1 text-xs text-amber-600">{notice}</span>}
        </div>

        <section className="mt-7 grid gap-4 lg:grid-cols-[1.72fr_0.88fr]" aria-label="Current weather">
          <article className="hero-weather relative isolate min-h-[330px] overflow-hidden rounded-[28px] p-6 text-white shadow-[0_22px_55px_rgba(35,93,171,0.2)] sm:p-8 lg:min-h-[355px] lg:p-9">
            <div className="hero-glow absolute -right-12 -top-24 -z-10 h-[350px] w-[350px] rounded-full" />
            <div className="absolute -right-5 top-[-50px] -z-10 opacity-[0.13] sm:right-8 sm:top-[-75px]">
              <Sun size={350} strokeWidth={0.65} />
            </div>
            <div className="absolute bottom-[-105px] right-[8%] -z-10 h-[210px] w-[64%] rounded-[50%] bg-white/[0.06] blur-2xl" />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-blue-100"><MapPin size={15} />{weather.city}, {weather.country}</div>
                <p className="mt-1.5 text-xs text-blue-200/75">{new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</p>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-blue-50 backdrop-blur-sm"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />{weather.demo ? "Sample forecast" : "Live forecast"}</span>
            </div>
            <div className="mt-6 flex items-center justify-between gap-2 sm:mt-4">
              <div>
                <div className="flex items-start text-[76px] font-semibold leading-[0.95] tracking-[-0.08em] sm:text-[94px]">{formatTemp(weather.temperature)}<span className="mt-2 text-4xl font-light tracking-normal text-blue-100 sm:text-5xl">{unit === "C" ? "C" : "F"}</span></div>
                <p className="mt-3 text-[17px] font-medium text-white">{weather.condition}</p>
                <p className="mt-1 text-sm text-blue-100/75">Feels like {formatTemp(weather.feelsLike)} <span className="px-1 text-blue-200/40">·</span> H:{formatTemp(weather.high)} L:{formatTemp(weather.low)}</p>
              </div>
              <WeatherIcon kind={weather.kind} className="mr-1 h-[88px] w-[88px] shrink-0 text-amber-200 drop-shadow-[0_0_24px_rgba(255,224,154,0.35)] sm:mr-6 sm:h-[118px] sm:w-[118px]" />
            </div>
            <div className="mt-6 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-4 sm:mt-7 sm:pt-5">
              <div className="flex items-center gap-2.5 pr-2 sm:gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-sky-100"><Droplets size={16} /></span><div><p className="text-[10px] text-blue-100/70 sm:text-[11px]">Humidity</p><p className="mt-0.5 text-xs font-semibold sm:text-sm">{weather.humidity}%</p></div></div>
              <div className="flex items-center gap-2.5 px-2 sm:gap-3 sm:px-4"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-sky-100"><Wind size={16} /></span><div><p className="text-[10px] text-blue-100/70 sm:text-[11px]">Wind</p><p className="mt-0.5 text-xs font-semibold sm:text-sm">{weather.wind} <span className="text-[10px] font-normal text-blue-100/70">km/h</span></p></div></div>
              <div className="flex items-center gap-2.5 pl-2 sm:gap-3 sm:pl-4"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-sky-100"><Gauge size={16} /></span><div><p className="text-[10px] text-blue-100/70 sm:text-[11px]">Pressure</p><p className="mt-0.5 text-xs font-semibold sm:text-sm">{weather.pressure} <span className="text-[10px] font-normal text-blue-100/70">hPa</span></p></div></div>
            </div>
          </article>

          <article className="flex min-h-[330px] flex-col rounded-[28px] border border-slate-200/70 bg-[#14243a] p-6 text-white shadow-[0_16px_42px_rgba(19,37,62,0.13)] sm:p-7 lg:min-h-[355px]">
            <div className="flex items-start justify-between">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Breathe easy</p><h2 className="mt-1.5 text-lg font-semibold tracking-tight">Air quality</h2></div>
              <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-white/[0.07] text-sky-300"><Wind size={19} /></div>
            </div>
            <div className="mt-6 flex items-end gap-3"><span className="text-[54px] font-semibold leading-none tracking-[-0.07em]">{weather.aqi}</span><span className={`mb-1 rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-semibold ${aqi.color}`}>{aqi.label}</span></div>
            <p className="mt-2 text-xs text-slate-400">US AQI <span className="px-1 text-slate-600">·</span> {weather.city}</p>
            <div className="mt-6">
              <div className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 via-55% to-rose-400"><div className="absolute -top-1 h-4 w-1.5 -translate-x-1/2 rounded-full border border-[#14243a] bg-white shadow" style={{ left: `${Math.max(4, Math.min(96, weather.aqi / 2.5))}%` }} /></div>
              <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-500"><span>Good</span><span>Moderate</span><span>Poor</span></div>
            </div>
            <div className="mt-auto flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3.5 sm:mt-5"><div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${aqi.bar}`} /><p className="text-xs leading-[1.65] text-slate-300">{aqi.note}</p></div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>Fine particles (PM2.5)</span><span>Live reading</span></div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.28fr_1fr]">
          <article className="rounded-[26px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_10px_32px_rgba(37,67,109,0.045)] backdrop-blur sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">The next few hours</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Today&apos;s forecast</h2></div><div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><ClockLabel /> Local time</div></div>
            <div className="mt-6 grid grid-cols-6 gap-1 sm:gap-2">
              {weather.hourly.map((hour, index) => <div key={`${hour.time}-${index}`} className={`flex flex-col items-center rounded-2xl px-1 py-3 transition ${index === 0 ? "bg-sky-50" : "hover:bg-slate-50"}`}><span className={`text-[11px] font-medium ${index === 0 ? "text-sky-700" : "text-slate-400"}`}>{hour.time}</span><WeatherIcon kind={hour.kind} className={`my-3 h-6 w-6 ${hour.kind === "sun" ? "text-amber-500" : "text-sky-500"}`} /><span className="text-sm font-semibold text-slate-800">{formatTemp(hour.temperature)}</span></div>)}
            </div>
          </article>
          <article className="rounded-[26px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_10px_32px_rgba(37,67,109,0.045)] backdrop-blur sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Plan a little ahead</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">5-day forecast</h2></div><span className="mt-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">{weather.city}</span></div>
            <div className="mt-4 divide-y divide-slate-100">
              {weather.forecast.map((day, index) => <div key={`${day.day}-${index}`} className="grid grid-cols-[1fr_34px_1fr] items-center gap-2 py-[9px] first:pt-1 last:pb-0"><span className="text-xs font-medium text-slate-600">{day.day}</span><WeatherIcon kind={day.kind} className={`mx-auto h-[19px] w-[19px] ${day.kind === "sun" ? "text-amber-500" : "text-sky-500"}`} /><div className="flex items-center justify-end gap-3 text-xs"><span className="font-semibold text-slate-800">{formatTemp(day.high)}</span><span className="text-slate-400">{formatTemp(day.low)}</span></div></div>)}
            </div>
          </article>
        </section>
        <footer className="flex flex-col items-center justify-between gap-2 px-1 pb-2 pt-7 text-[11px] text-slate-400 sm:flex-row"><span>SkyCast <span className="px-1 text-slate-300">/</span> A clearer view of your day.</span><span>Weather data by Open-Meteo <span className="px-1 text-slate-300">·</span> {weather.demo ? "Demo forecast" : "Updated live"}</span></footer>
      </div>
    </main>
  );
}

function ClockLabel() {
  return <ArrowUp className="h-3 w-3 rotate-45" aria-hidden="true" />;
}
