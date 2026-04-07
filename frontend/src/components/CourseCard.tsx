import { Link } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'

type CourseCardProps = {
  id: string
  code: string
  name: string
  credits: number
  period: string
  department?: string | null
}

export default function CourseCard({ id, code, name, credits, period, department }: CourseCardProps) {
  const { toggleFavorite, isFavorite } = useFavorites()
  const favorited = isFavorite(id)

  return (
    <Link
      to={`/course/${id}`}
      className="bg-white rounded-lg border border-gray-200 p-4 block hover:shadow-sm transition group"
    >
      <div className="flex justify-between items-start">
        <div>
          <span className="text-sm font-mono text-[#0065BD]">{code}</span>
          {department && (
            <span className="ml-2 text-xs text-gray-400">{department}</span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleFavorite(id)
          }}
          className="text-gray-300 hover:text-black transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={favorited ? "black" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>
      <h3 className="font-semibold text-black mt-2 group-hover:text-[#0065BD]">{name}</h3>
      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
        <span>{credits} cr</span>
        <span>•</span>
        <span>{period}</span>
      </div>
    </Link>
  )
}
