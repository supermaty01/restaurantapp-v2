import React, { createContext, useState } from 'react';

import { DishListDTO } from '@/features/dishes/types/dish-dto';

interface NewDishContextData {
  newDish: DishListDTO | null;
  setNewDish: (id: DishListDTO | null) => void;
}

export const NewDishContext = createContext<NewDishContextData | undefined>(undefined);

export const NewDishProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [newDish, setNewDish] = useState<DishListDTO | null>(null);
  return (
    <NewDishContext.Provider value={{ newDish, setNewDish }}>
      {children}
    </NewDishContext.Provider>
  );
};
