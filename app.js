const dotenv = require('dotenv')
dotenv.config()

/**
 * ------------- EXPRESS SETUP -----------
 */
const express = require('express')
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

/**
 *  ---------------- SERVER ---------------
 */
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}!`)
})
