import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-black mb-4">About</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-sm text-gray-500 hover:text-black">Home</Link></li>
              <li><Link to="/search" className="text-sm text-gray-500 hover:text-black">Search Courses</Link></li>
              <li><Link to="/degree" className="text-sm text-gray-500 hover:text-black">Degree Planner</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-black mb-4">Feedback</h3>
            <ul className="space-y-2">
              <li><a href="mailto:feedback@aaltopath.fi" className="text-sm text-gray-500 hover:text-black">Send Feedback</a></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-black">Report an Issue</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-black mb-4">Shortlist</h3>
            <ul className="space-y-2">
              <li><Link to="/favorites" className="text-sm text-gray-500 hover:text-black">Saved Courses</Link></li>
              <li><Link to="/degree" className="text-sm text-gray-500 hover:text-black">My Plan</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200 px-8 py-4">
        <p className="text-xs text-gray-500 text-center max-w-[1200px] mx-auto">
          This project is not officially affiliated with or endorsed by Aalto University. While it synchronizes with the official Aalto API database, errors may occur. Always verify your official status on <a href="https://sisu.aalto.fi" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">Aalto Sisu</a>.
        </p>
      </div>
    </footer>
  )
}
