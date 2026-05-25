<?php

/**
 * EduStack Adminer entrypoint.
 *
 * Adminer ships as a single PHP file. We don't connect to a network database
 * server here — the EduStack backend stores everything in a SQLite *file*
 * (`/data/edustack.db` in a deployed sandbox, the local wrangler/D1 file in
 * dev). So instead of asking the operator to pick a driver and type a path,
 * this wrapper:
 *
 *   1. Pins the driver to `sqlite` and the database to $ADMINER_DB_PATH, so the
 *      connection is fully prefilled — there is nothing to choose.
 *   2. Replaces Adminer's normal login (which for SQLite has no real
 *      credentials) with a single password field checked against
 *      $ADMINER_PASSWORD. That password is the "credential" surfaced in the
 *      login helper on the frontend.
 *
 * Required env:
 *   ADMINER_DB_PATH   absolute path to the SQLite file Adminer should open
 *   ADMINER_PASSWORD  password the user must type to get in
 */

$ADMINER_DB_PATH = getenv('ADMINER_DB_PATH') ?: '';
$ADMINER_PASSWORD = getenv('ADMINER_PASSWORD') ?: '';

// Adminer keys its session/permanent login by server+driver+db. Forcing the
// auth payload here means Adminer treats every visitor as "already pointed at
// the right database" — only the password gate remains.
if (!isset($_GET['sqlite']) && !isset($_GET['username'])) {
    // Default landing: send the browser straight at the SQLite driver so the
    // driver/server/db selectors never render.
    $_GET['sqlite'] = '';
}

function adminer_object() {
    // Pull the Adminer base class into scope; it is only defined once the
    // bundled adminer.php below is included, so this function is what Adminer
    // calls *after* that include.
    class EduStackAdminer extends Adminer {
        function name() {
            return 'EduStack DB — ' . htmlspecialchars(getenv('FLY_APP_NAME') ?: 'local');
        }

        // Force the SQLite driver + fixed file. server/user/pass are unused for
        // SQLite; the third element is the database (file path) Adminer opens.
        function credentials() {
            return array('', '', '');
        }

        function database() {
            return getenv('ADMINER_DB_PATH') ?: '';
        }

        function databases($flush = true) {
            return array(getenv('ADMINER_DB_PATH') ?: '');
        }

        // Only the SQLite driver is offered.
        function loginForm() {
            $pwField = '<input type="password" name="auth[password]" autocomplete="current-password" autofocus>';
            echo "<table cellspacing='0' class='layout'>\n";
            echo "<tr><th>Password<td>$pwField\n";
            echo "</table>\n";
            // Hidden fields pin the connection so the user never picks a driver
            // or types a path — the connection is fully prefilled.
            echo "<input type='hidden' name='auth[driver]' value='sqlite'>\n";
            echo "<input type='hidden' name='auth[server]' value=''>\n";
            echo "<input type='hidden' name='auth[username]' value=''>\n";
            echo "<input type='hidden' name='auth[db]' value='" . htmlspecialchars(getenv('ADMINER_DB_PATH') ?: '') . "'>\n";
            echo "<p><input type='submit' value='Login'>\n";
            echo "<input type='hidden' name='auth[permanent]' value='1'>\n";
        }

        // The only real gate: the shared Adminer password.
        function login($login, $password) {
            $expected = getenv('ADMINER_PASSWORD') ?: '';
            if ($expected === '') {
                return 'Adminer is not configured (ADMINER_PASSWORD is empty).';
            }
            if (!hash_equals($expected, (string) $password)) {
                return false;
            }
            return true;
        }
    }

    return new EduStackAdminer;
}

// The bundled Adminer binary. Pulled in at Docker build time / by the local
// launcher (scripts/adminer.sh) into ./adminer.php so it is never committed.
require __DIR__ . '/adminer.php';
