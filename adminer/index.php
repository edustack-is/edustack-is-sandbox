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
 *      login helper / monitoring page on the frontend.
 *   3. Loads a set of Adminer plugins (table/index structure, tables filter,
 *      design switcher) by extending AdminerPlugin. Plugin/design files are
 *      fetched by fetch-assets.sh into ./plugins and ./designs.
 *
 * Required env:
 *   ADMINER_DB_PATH   absolute path to the SQLite file Adminer should open
 *   ADMINER_PASSWORD  password the user must type to get in
 */

$ADMINER_DB_PATH = getenv('ADMINER_DB_PATH') ?: '';
$ADMINER_PASSWORD = getenv('ADMINER_PASSWORD') ?: '';

// Default landing: send the browser straight at the SQLite driver so the
// driver/server/db selectors never render.
if (!isset($_GET['sqlite']) && !isset($_GET['username'])) {
    $_GET['sqlite'] = '';
}

function adminer_object() {
    // adminer.php (required below) has by now defined the base `Adminer` class,
    // so AdminerPlugin (which extends it) and the plugin classes can load.
    include_once __DIR__ . '/plugins/plugin.php';
    foreach (
        array(
            'table-structure',
            'table-indexes-structure',
            'tables-filter',
            'designs',
            'login-password-less', // loaded but not activated — see note below
        ) as $p
    ) {
        $file = __DIR__ . "/plugins/$p.php";
        if (is_file($file)) {
            include_once $file;
        }
    }

    // EduStack wrapper: pins the SQLite connection + a real password gate, and
    // hosts the feature plugins through AdminerPlugin's delegation. The methods
    // we override below run directly (bypassing plugins); every other Adminer
    // method falls through to the plugins (table/index structure, filter,
    // design switcher).
    class EduStackAdminer extends AdminerPlugin {
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

        // Password-only form; hidden fields pin the connection so the user never
        // picks a driver or types a path — the connection is fully prefilled.
        function loginForm() {
            echo "<table cellspacing='0' class='layout'>\n";
            echo "<tr><th>Password<td><input type='password' name='auth[password]' autocomplete='current-password' autofocus>\n";
            echo "</table>\n";
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

        // Stable secret used to sign/encrypt the "permanent login" cookie.
        // Without this Adminer shows "master password expired" on every revisit
        // and forces re-login. Must return the SAME value across requests, so
        // we derive it from the Adminer password (stable per deployment).
        function permanentLogin($create = false) {
            return hash('sha256', 'edustack-adminer:' . (getenv('ADMINER_PASSWORD') ?: ''));
        }
    }

    $plugins = array(
        new AdminerTableStructure(),
        new AdminerTableIndexesStructure(),
        new AdminerTablesFilter(),
        // Design switcher (bottom-right dropdown). konya is the requested
        // alternative; the *-dark designs cover dark mode (the standalone
        // dark-switcher plugin is Adminer 5.x only). CSS is served locally
        // from ./designs/<name>/adminer.css.
        new AdminerDesigns(array(
            'designs/konya/adminer.css' => 'Konya',
            'designs/dracula/adminer.css' => 'Dracula (dark)',
        )),
    );

    // NOTE: AdminerLoginPasswordLess is vendored and loaded above but NOT
    // enabled. Activating it (push it onto $plugins, drop the login()/loginForm
    // overrides) makes Adminer passwordless — and because SQLite ignores DB
    // credentials, that means *anyone with the link* gets full DB access. When
    // you switch to it, also stop showing the password in the login helper /
    // monitoring page and just show the link.

    return new EduStackAdminer($plugins);
}

// The bundled Adminer binary. Fetched by fetch-assets.sh into ./adminer.php.
require __DIR__ . '/adminer.php';
