const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')
const { body, validationResult } = require('express-validator')
dotenv.config()

const path = require('node:path')

/**
 * ------------- EXPRESS SETUP -----------
 */
const express = require('express')
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

/**
 * ------------- POSTGRES SETUP -----------
 */
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DB_URI,
})

/**
 * ---------------- VIEWS ----------------
 */
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

/**
 * ---------------- ROUTES ----------------
 */
app.get('/signup', (req, res) => res.render('signUpForm'))
app.post(
  '/signup',
  body('password').isLength({ min: 3 }),
  body('passwordConfirmation').custom((value, { req }) => {
    return value === req.body.password
  }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
        if (err) {
          return next(err)
        }

        const { firstName, lastName, email } = req.body
        await pool.query(
          'INSERT INTO users (first_name, last_name, email, password) VALUES ($1, $2, $3, $4)',
          [firstName, lastName, email, hashedPassword],
        )
        res.json({ message: 'User created successfully ' })
      })
    } catch (err) {
      return next(err)
    }
  },
)

/**
 *  ---------------- SERVER ---------------
 */
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}!`)
})
