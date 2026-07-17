import { useContext } from "react";

import { NewDishContext } from "@/lib/context/NewDishContext";

export const useNewDish = () => {
  const context = useContext(NewDishContext);
  if (!context) {
    throw new Error('useNewDish must be used within a NewDishProvider');
  }
  return context;
};