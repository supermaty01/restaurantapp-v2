import { useContext } from "react";

import { NewRestaurantContext } from "@/lib/context/NewRestaurantContext";

export const useNewRestaurant = () => {
  const context = useContext(NewRestaurantContext);
  if (!context) {
    throw new Error('useNewRestaurant must be used within a NewRestaurantProvider');
  }
  return context;
};