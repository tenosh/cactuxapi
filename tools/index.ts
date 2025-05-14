import { identifyZoneTool } from "./identify-zone";
import { retrieveRelevantClimbingDataTool } from "./retrieve-climbing-data";
import { retrieveAccommodationDataTool } from "./retrieve-accommodation-data";
import { weatherTool } from "./weather";

export const tools = {
  weather: weatherTool,
  identifyZone: identifyZoneTool,
  retrieveRelevantClimbingData: retrieveRelevantClimbingDataTool,
  retrieveAccommodationData: retrieveAccommodationDataTool,
};
