import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../supabase'

type FavoritesContextType = {
  favorites: string[]
  addFavorite: (courseId: string) => void
  removeFavorite: (courseId: string) => void
  toggleFavorite: (courseId: string) => void
  isFavorite: (courseId: string) => boolean
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    const loadFavorites = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('user_favorites')
          .select('course_id')
          .eq('user_id', user.id)
        if (data) {
          setFavorites(data.map(f => f.course_id))
        }
      }
    }
    loadFavorites()
  }, [])

  const addFavorite = async (courseId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_favorites').insert({
        user_id: user.id,
        course_id: courseId
      })
      setFavorites(prev => [...prev, courseId])
    }
  }

  const removeFavorite = async (courseId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_favorites').delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId)
      setFavorites(prev => prev.filter(id => id !== courseId))
    }
  }

  const toggleFavorite = (courseId: string) => {
    if (favorites.includes(courseId)) {
      removeFavorite(courseId)
    } else {
      addFavorite(courseId)
    }
  }

  const isFavorite = (courseId: string) => favorites.includes(courseId)

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider')
  }
  return context
}
