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
  };
  weather: Array<{
    description: string;
  }>;
  wind: {
    speed: number;
  };
}

interface WeatherResponse {
  list: WeatherReading[];
}

export const weatherTool = tool({
  description:
    "Get current and forecast weather for a climbing location, give the user the average temp for the day, neither max or min.",
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
        .filter((reading: WeatherReading) =>
          reading.dt_txt.includes("12:00:00")
        )
        .map((reading: WeatherReading) => ({
          date: new Date(reading.dt * 1000).toLocaleDateString(),
          temp: Math.round(reading.main.temp),
          feels_like: Math.round(reading.main.feels_like),
          conditions: reading.weather[0]?.description || "Desconocido",
          wind_speed: reading.wind.speed,
          humidity: reading.main.humidity,
        }));

      return {
        location: normalizedLocation,
        current: {
          temp: Math.round(weatherData.list[0]?.main.temp || 0),
          feels_like: Math.round(weatherData.list[0]?.main.feels_like || 0),
          conditions:
            weatherData.list[0]?.weather[0]?.description || "Desconocido",
          wind_speed: weatherData.list[0]?.wind.speed || 0,
          humidity: weatherData.list[0]?.main.humidity || 0,
        },
        forecast,
      };
    } catch (error) {
      console.error("Weather tool error:", error);
      return {
        error: "Failed to fetch weather data",
      };
    }
  },
});
