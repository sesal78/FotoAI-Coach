'use client';

import { useQuery } from '@tanstack/react-query';
import { listFotoaiEditingRecipes, type FotoaiEditingRecipe } from '@/lib/fotoai/client-ai';

/** Editing-recipe history of the session user (identity from the session cookie). */
export function useEditingRecipes(enabled: boolean) {
  return useQuery<FotoaiEditingRecipe[]>({
    queryKey: ['fotoai', 'editing'],
    queryFn: () => listFotoaiEditingRecipes(),
    enabled,
  });
}
