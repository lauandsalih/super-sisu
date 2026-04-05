const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Super Sisu</h1>
      <p className="text-gray-500 mb-8">Your Aalto academic companion</p>
      <a href="/search" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
        Search Courses
      </a>
    </div>
  )
}

export default Home
