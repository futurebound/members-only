const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')
const path = require('node:path')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const { body, validationResult } = require('express-validator')

/**
 * ------------- EXPRESS SETUP -----------
 */
const express = require('express')
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/**
 * ------------- POSTGRES SETUP -----------
 */
// const { pool } = require('./db/pool')
const { Pool } = require('pg')
const expressSession = require('express-session')
const pgSession = require('connect-pg-simple')(expressSession)

const pool = new Pool({
  connectionString: process.env.DB_URI,
})

const sessionStore = new pgSession({
  pool: pool,
  tableName: 'session',
  createTableIfMissing: true,
})

app.use(
  expressSession({
    store: sessionStore,
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
      // 1000ms = 1s, 60s = 1m, 60m = 1hr, 24hr = 1day
      maxAge: 1000 * 60 * 60 * 24,
      secure: false,
    }, // 1 day
  }),
)

// logging middleware to verify session created
app.use((req, res, next) => {
  console.log('Session ID:', req.sessionID)
  console.log('Session:', req.session)
  next()
})

/**
 * ---------------- PASSPORT ----------------
 */
app.use(passport.session())
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const { rows } = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email],
        )
        const user = rows[0]

        if (!user) {
          return done(null, false, { message: 'Incorrect email' })
        }
        const match = await bcrypt.compare(password, user.password)
        if (!match) {
          return done(null, false, { message: 'Incorrect password' })
        }
        return done(null, user)
      } catch (err) {
        return done(err)
      }
    },
  ),
)

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id])
    const user = rows[0]

    done(null, user)
  } catch (err) {
    done(err)
  }
})

/**
 * ---------------- VIEWS ----------------
 */
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

/**
 * ---------------- ROUTES ----------------
 */
app.use((req, res, next) => {
  res.locals.currentUser = req.user
  next()
})

const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next()
  }
  res.redirect('/')
}

app.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT 
      messages.id AS message_id,
      messages.title,
      messages.text,
      messages.created_at,
      users.first_name,
      users.last_name
    FROM 
      messages
    INNER JOIN 
      users
    ON 
      messages.author_id = users.id;`,
  )
  res.render('index', { user: req.user, messages: rows })
})

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

        const { firstName, lastName, email, isAdmin } = req.body
        // console.log(isAdmin)
        await pool.query(
          'INSERT INTO users (first_name, last_name, email, password, is_admin) VALUES ($1, $2, $3, $4, $5)',
          [firstName, lastName, email, hashedPassword, isAdmin],
        )
        res.redirect('/')
      })
    } catch (err) {
      return next(err)
    }
  },
)

app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/',
  }),
)

app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err)
    }
    res.redirect('/')
  })
})

app.get('/new', (req, res) => res.render('newMessageForm'))

app.post('/messages', async (req, res, next) => {
  try {
    await pool.query(
      `INSERT INTO messages (title, text, author_id) VALUES ($1, $2, $3)`,
      [req.body.title, req.body.text, req.user.id],
    )
    res.redirect('/')
  } catch (err) {
    return next(err)
  }
})

app.get('/member', isAuthenticated, (req, res) => {
  res.render('memberForm')
})

app.post('/member', async (req, res, next) => {
  const { id } = req.user
  const { memberCode } = req.body
  console.log(`id: ${id} memberCode: ${memberCode}`)
  try {
    const isValidCode = process.env.MEMBER_CODE === memberCode
    if (!isValidCode) {
      return res.status(400).json({ message: 'Invalid member code' })
    }

    const { rows } = await pool.query(
      `UPDATE users SET is_member = true WHERE id = $1 RETURNING *`,
      [id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.redirect('/')
  } catch (err) {
    return next(err)
  }
})

/**
 *  ---------------- SERVER ---------------
 */
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}!`)
})
