package app.comma.tracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.comma.tracker.ui.CommaTheme
import app.comma.tracker.ui.ExpenseEditScreen
import app.comma.tracker.ui.ExpensesScreen
import app.comma.tracker.ui.HomeScreen
import app.comma.tracker.ui.LocalSnackbar
import app.comma.tracker.ui.ReportsScreen
import app.comma.tracker.ui.SettingsScreen
import app.comma.tracker.ui.ShiftEditScreen
import app.comma.tracker.ui.ShiftsScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as CommaApp
        setContent {
            val theme by app.prefs.theme.collectAsStateWithLifecycle()
            val dark = when (theme) {
                "light" -> false
                "dark" -> true
                else -> isSystemInDarkTheme()
            }
            CommaTheme(dark) { CommaNav(app) }
        }
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("home", "Home", Icons.Outlined.Home),
    Tab("shifts", "Shifts", Icons.Outlined.Schedule),
    Tab("expenses", "Expenses", Icons.AutoMirrored.Outlined.ReceiptLong),
    Tab("reports", "Reports", Icons.Outlined.BarChart),
)

@Composable
private fun CommaNav(app: CommaApp) {
    val nav = rememberNavController()
    val route = nav.currentBackStackEntryAsState().value?.destination?.route
    val snackbar = remember { SnackbarHostState() }

    val notice by app.notice.collectAsStateWithLifecycle()
    LaunchedEffect(notice) {
        notice?.let {
            app.notice.value = null
            snackbar.showSnackbar(it)
        }
    }

    CompositionLocalProvider(LocalSnackbar provides snackbar) {
        Scaffold(
            contentWindowInsets = WindowInsets(0),
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                if (tabs.any { it.route == route }) {
                    NavigationBar {
                        tabs.forEach { tab ->
                            NavigationBarItem(
                                selected = route == tab.route,
                                onClick = {
                                    nav.navigate(tab.route) {
                                        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(tab.icon, contentDescription = null) },
                                label = { Text(tab.label) },
                            )
                        }
                    }
                }
            },
        ) { padding ->
            NavHost(nav, startDestination = "home", modifier = Modifier.padding(padding).consumeWindowInsets(padding)) {
                composable("home") { HomeScreen(nav) }
                composable("shifts") { ShiftsScreen(nav) }
                composable("expenses") { ExpensesScreen(nav) }
                composable("reports") { ReportsScreen() }
                composable("settings") { SettingsScreen(nav) }
                // id is a shift's id, "new" for a manual entry, or "finish" for the shift just tracked.
                composable("shift/{id}") { ShiftEditScreen(nav, it.arguments?.getString("id") ?: "new") }
                composable("expense/{id}") { ExpenseEditScreen(nav, it.arguments?.getString("id") ?: "new") }
            }
        }
    }
}
