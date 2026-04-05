import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import { createSupabaseClient } from './supabase'

const supabase = createSupabaseClient()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/', async (req, res) => {
  const { data, error } = await supabase.from('courses').select('*')
  if (error) {
    res.json({ message: 'Supabase connected but no tables yet', error: error.message })
  } else {
    res.json({ message: 'Supabase connected successfully', data })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})