import { z } from "zod";
import { tool } from "ai";
import { supabase } from "@/lib/supabase";

interface WeatherReading {
  dt: number;
  dt_txt: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    description: string;
  }>;
  wind: {
    speed: number;
  };
  clouds: {
    all: number;
  };
  pop: number;
}

interface WeatherResponse {
  list: WeatherReading[];
}

export const weatherTool = tool({
  description:
    "Get current and forecast weather for a climbing location, give the user the max and min temperature for the next 5 days.",
  parameters: z.object({
    location: z.string().describe("The climbing zone to get weather for"),
  }),
  execute: async ({ location }) => {
    const normalizeLocation = (location: string): string => {
      if (!location) return "guadalcazar";

      const zoneMap: Record<string, string> = {
        "gruta de las candelas": "Gruta de las Candelas",
        "las candelas": "Gruta de las Candelas",
        candelas: "Gruta de las Candelas",
        "joya del salitre": "Joya del Salitre",
        "el salitre": "Joya del Salitre",
        salitre: "Joya del Salitre",
        panales: "Panales",
        "san cayetano": "San Cayetano",
        "san caye": "San Cayetano",
        cayetano: "San Cayetano",
        zelda: "Zelda",
        "cuevas cuatas": "Zelda",
        guadalcazar: "Guadalcazar",
      };

      const normalizedInput = location.toLowerCase().trim();
      return zoneMap[normalizedInput] || "Guadalcazar";
    };
    const normalizedLocation = normalizeLocation(location);
    const tableName = normalizedLocation === "Guadalcazar" ? "place" : "sector";
    try {
      // First get coordinates from database for the location
      const { data: locationData, error: locationError } = await supabase
        .from(tableName)
        .select("latitude, longitude")
        .ilike("name", normalizedLocation)
        .single();

      if (locationError || !locationData) {
        return {
          error: "Location coordinates not found in database",
        };
      }

      const { latitude, longitude } = locationData;

      const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=es`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Weather API request failed");
      }

      const weatherData: WeatherResponse = await response.json();

      // Process and format the weather data with proper typing
      const forecast = weatherData.list
        .filter((reading: WeatherReading) => {
          // Get readings for 9:00, 12:00, 15:00, and 18:00 to show daily progression
          const hour = new Date(reading.dt * 1000).getHours();
          return [9, 12, 15, 18].includes(hour);
        })
        .map((reading: WeatherReading) => ({
          date: new Date(reading.dt * 1000).toLocaleDateString(),
          time: new Date(reading.dt * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          temp: Math.round(reading.main.temp),
          feels_like: Math.round(reading.main.feels_like),
          temp_min: Math.round(reading.main.temp_min),
          temp_max: Math.round(reading.main.temp_max),
          conditions: reading.weather[0]?.description || "Desconocido",
          wind_speed: Math.round(reading.wind.speed * 3.6), // Convert m/s to km/h
          humidity: reading.main.humidity,
          clouds: reading.clouds.all,
          pop: Math.round(reading.pop * 100), // Convert probability to percentage
        }));

      // Group forecast by day
      const dailyForecast = forecast.reduce((acc: any, reading) => {
        const date = reading.date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(reading);
        return acc;
      }, {});

      return {
        location: normalizedLocation,
        current: {
          temp: Math.round(weatherData.list[0]?.main.temp || 0),
          feels_like: Math.round(weatherData.list[0]?.main.feels_like || 0),
          conditions:
            weatherData.list[0]?.weather[0]?.description || "Desconocido",
          wind_speed: Math.round(weatherData.list[0]?.wind.speed * 3.6 || 0),
          humidity: weatherData.list[0]?.main.humidity || 0,
          clouds: weatherData.list[0]?.clouds.all || 0,
        },
        forecast: dailyForecast,
      };
    } catch (error) {
      console.error("Weather tool error:", error);
      return {
        error: "Failed to fetch weather data",
      };
    }
  },
});
