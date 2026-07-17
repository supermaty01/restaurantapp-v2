import React, { createContext, useState } from 'react';

interface NewRestaurantContextData {
  newRestaurantId: number | null;
  setNewRestaurantId: (id: number | null) => void;
}

export const NewRestaurantContext = createContext<NewRestaurantContextData | undefined>(undefined);

export const NewRestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [newRestaurantId, setNewRestaurantId] = useState<number | null>(null);
  return (
    <NewRestaurantContext.Provider value={{ newRestaurantId, setNewRestaurantId }}>
      {children}
    </NewRestaurantContext.Provider>
  );
};


