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
 *   2. Logs in passwordless (this is an educational sandbox; SQLite has no
 *      credentials anyway). The login form auto-submits, so opening Adminer
 *      drops you straight into the database.
 *   3. Loads a set of Adminer plugins (table/index structure, tables filter,
 *      design switcher) by extending AdminerPlugin. Plugin/design files are
 *      fetched by fetch-assets.sh into ./plugins and ./designs.
 *
 * Required env:
 *   ADMINER_DB_PATH   absolute path to the SQLite file Adminer should open
 *   ADMINER_PASSWORD  not a login gate anymore — start.sh uses it as the
 *                     "Adminer enabled" flag and it seeds permanentLogin()
 */

$ADMINER_DB_PATH = getenv('ADMINER_DB_PATH') ?: '';

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

        // Passwordless (educational sandbox — no credentials by design). The
        // connection is fully pinned via hidden fields; the form auto-submits so
        // opening Adminer drops you straight into the DB. The button is a
        // no-JS fallback.
        function loginForm() {
            echo "<input type='hidden' name='auth[driver]' value='sqlite'>\n";
            echo "<input type='hidden' name='auth[server]' value=''>\n";
            echo "<input type='hidden' name='auth[username]' value=''>\n";
            echo "<input type='hidden' name='auth[password]' value=''>\n";
            echo "<input type='hidden' name='auth[db]' value='" . htmlspecialchars(getenv('ADMINER_DB_PATH') ?: '') . "'>\n";
            echo "<input type='hidden' name='auth[permanent]' value='1'>\n";
            echo "<p><input type='submit' value='Otevřít databázi'>\n";
            $nonce = function_exists('nonce') ? nonce() : '';
            echo "<script$nonce>document.currentScript.closest('form').submit();</script>\n";
        }

        // Passwordless: no gate. SQLite has no credentials and this is an
        // educational sandbox, so any login attempt is accepted.
        function login($login, $password) {
            return true;
        }

        // Stable secret used to sign/encrypt the "permanent login" cookie.
        // Without this Adminer shows "master password expired" on every revisit.
        // Must return the SAME value across requests; seeded from ADMINER_PASSWORD
        // (which is still set per deployment) so it's stable.
        function permanentLogin($create = false) {
            return hash('sha256', 'edustack-adminer:' . (getenv('ADMINER_PASSWORD') ?: 'edustack'));
        }

        // Default the view style to Konya. parent::css() returns the design the
        // user picked in the switcher (or [] for none) — so we only fall back to
        // Konya when nothing else is selected, keeping the switcher functional.
        function css() {
            $css = parent::css();
            if (empty($css)) {
                $css[] = 'designs/konya/adminer.css';
            }
            return $css;
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

    return new EduStackAdminer($plugins);
}

// The bundled Adminer binary. Fetched by fetch-assets.sh into ./adminer.php.
require __DIR__ . '/adminer.php';
