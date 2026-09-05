// Login con Google (OAuth 2.0) vía Passport. No hay base de datos de usuarios:
// el "usuario" es simplemente lo que Google nos devuelve (email, nombre, foto),
// guardado en la sesión (cookie firmada), nada se persiste en disco.
//
// Restricción de acceso: solo se admite email cuyo dominio sea ALLOWED_EMAIL_DOMAIN
// (variable de entorno). Si querés permitir una lista puntual de correos en vez
// de un dominio entero, es un cambio chico en isEmailAllowed() más abajo.

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

function isEmailAllowed(email) {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (!domain) return true; // sin restricción configurada (no recomendado en producción)
  return email && email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

function configurePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;

        if (!isEmailAllowed(email)) {
          return done(null, false, { message: 'dominio_no_autorizado' });
        }

        const user = {
          id: profile.id,
          email,
          name: profile.displayName,
          picture: profile.photos && profile.photos[0] && profile.photos[0].value,
        };
        return done(null, user);
      }
    )
  );

  // Todo el "usuario" cabe en la sesión — no hay tabla de usuarios que consultar.
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

module.exports = { configurePassport, isEmailAllowed };
