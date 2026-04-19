import { Link } from 'react-router-dom'

const Home = () => {
  return (
    <div className="max-w-[1200px] mx-auto px-8 py-12">
      <section className="text-center py-16">
        <h1 className="text-5xl font-extrabold text-black mb-4 tracking-tight">
          Master Your Studies at Aalto.
        </h1>
        <p className="text-xl text-gray-500 mb-8">
          Track progress, plan semesters, and explore reviews.
        </p>
      </section>

<section className="mt-8">
          <div className="grid grid-cols-3 gap-6">
            <Link to="/degree" className="block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer">
              <h3 className="text-xl font-bold text-black mb-2">Academic Tracker</h3>
              <p className="text-sm text-gray-500">Plan your semesters</p>
            </Link>
            <Link to="/profile" className="block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer">
              <h3 className="text-xl font-bold text-black mb-2">My Profile</h3>
              <p className="text-sm text-gray-500">View your courses & grades</p>
            </Link>
            <Link to="/search" className="block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer">
              <h3 className="text-xl font-bold text-black mb-2">Search Courses</h3>
              <p className="text-sm text-gray-500">Browse all Aalto courses</p>
            </Link>
          </div>
        </section>
    </div>
  )
}

export default Home