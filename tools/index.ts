import { identifyZoneTool } from "./identify-zone";
import { retrieveRelevantClimbingDataTool } from "./retrieve-climbing-data";
import { retrieveAccommodationDataTool } from "./retrieve-accommodation-data";
import { weatherTool } from "./weather";
import { enhanceUserQueryTool } from "./enhance-user-query";

export const tools = {
  // enhanceUserQuery: enhanceUserQueryTool,
  weather: weatherTool,
  identifyZone: identifyZoneTool,
  retrieveRelevantClimbingData: retrieveRelevantClimbingDataTool,
  retrieveAccommodationData: retrieveAccommodationDataTool,
};
