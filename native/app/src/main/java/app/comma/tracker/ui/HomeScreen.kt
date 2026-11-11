package app.comma.tracker.ui

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.comma.tracker.data.ActiveShift
import app.comma.tracker.tracking.TrackingService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(nav: NavController) {
    val app = app()
    val context = LocalContext.current
    val active by remember { app.dao.active().map { Loaded(it) } }.collectAsStateWithLifecycle(null)

    val today = LocalDate.now()
    val week = remember(today) { Period.of(Span.WEEK, today) }
    val weekTotals by remember(week) { app.dao.shiftTotals(week.from, week.to) }.collectAsStateWithLifecycle(null)
    val todayTotals by remember(today) {
        app.dao.shiftTotals(today.startMillis(), today.plusDays(1).startMillis())
    }.collectAsStateWithLifecycle(null)
    val recent by remember { app.dao.recentShifts(3) }.collectAsStateWithLifecycle(emptyList())

    var choosingPlatform by remember { mutableStateOf(false) }
    var pendingPlatform by rememberSaveable { mutableStateOf<String?>(null) }
    var locationDenied by remember { mutableStateOf(false) }
    var confirmEnd by remember { mutableStateOf(false) }
    var confirmDiscard by remember { mutableStateOf(false) }

    fun change(update: (ActiveShift?, Long) -> ActiveShift?) {
        app.scope.launch {
            val next = update(app.dao.activeNow(), System.currentTimeMillis())
            if (next == null) app.dao.clearActive() else app.dao.saveActive(next)
            TrackingService.sync(app)
        }
    }

    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        val platform = pendingPlatform
        pendingPlatform = null
        if (!TrackingService.hasLocationPermission(context)) {
            locationDenied = true
        } else if (platform != null) {
            app.prefs.lastPlatform = platform
            change { _, now -> ActiveShift(platform = platform, startTime = now) }
        }
    }

    fun start(platform: String) {
        pendingPlatform = platform
        permissions.launch(
            buildList {
                add(Manifest.permission.ACCESS_FINE_LOCATION)
                add(Manifest.permission.ACCESS_COARSE_LOCATION)
                if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            }.toTypedArray()
        )
    }

    // If the process was killed mid-shift, opening the app puts the GPS service back.
    val running = active?.value?.let { !it.isEnded && !it.isPaused } == true
    LaunchedEffect(running) { if (running) TrackingService.sync(context) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Comma") },
                actions = {
                    IconButton(onClick = { nav.navigate("settings") }) {
                        Icon(Icons.Outlined.Settings, contentDescription = "Settings")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            active?.let { loaded ->
                val shift = loaded.value
                when {
                    shift == null -> Button(
                shape = ButtonShape,
                        onClick = {
                            val platforms = app.prefs.platforms.value
                            if (platforms.size == 1) start(platforms.first()) else choosingPlatform = true
                        },
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                    ) { Text("Start shift", style = MaterialTheme.typography.titleMedium) }

                    shift.isEnded -> EndedShiftCard(
                        shift,
                        onAddEarnings = { nav.navigate("shift/finish") },
                        onDiscard = { confirmDiscard = true },
                    )

                    else -> ActiveShiftCard(
                        shift,
                        onPause = { change { a, now -> a?.copy(pausedAt = now) } },
                        onResume = {
                            change { a, now -> a?.copy(pausedMs = a.pausedMs + now - (a.pausedAt ?: now), pausedAt = null) }
                        },
                        onEnd = { confirmEnd = true },
                    )
                }
            }

            Panel {
                Text("This week", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Money(money(weekTotals?.total ?: 0.0), style = MaterialTheme.typography.displaySmall)
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth()) {
                    Stat("Hours", duration(weekTotals?.seconds ?: 0), Modifier.weight(1f))
                    Stat("Distance", km(weekTotals?.km ?: 0.0), Modifier.weight(1f))
                    Stat("Per hour", perHour(weekTotals?.total ?: 0.0, weekTotals?.seconds ?: 0), Modifier.weight(1f))
                }
            }

            Panel {
                Text("Today", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth()) {
                    Stat("Earned", money(todayTotals?.total ?: 0.0), Modifier.weight(1f))
                    Stat("Hours", duration(todayTotals?.seconds ?: 0), Modifier.weight(1f))
                    Stat("Distance", km(todayTotals?.km ?: 0.0), Modifier.weight(1f))
                }
            }

            if (recent.isNotEmpty()) {
                SectionTitle("Recent shifts")
                recent.forEach { shift -> ShiftRow(shift) { nav.navigate("shift/${shift.id}") } }
            }
        }
    }

    if (choosingPlatform) {
        PlatformDialog(
            platforms = app.prefs.platforms.collectAsStateWithLifecycle().value,
            initial = app.prefs.lastPlatform,
            onDismiss = { choosingPlatform = false },
            onStart = {
                choosingPlatform = false
                start(it)
            },
        )
    }
    if (locationDenied) {
        AlertDialog(
            onDismissRequest = { locationDenied = false },
            title = { Text("Location is off") },
            text = { Text("Comma needs precise location to measure the distance you drive on a shift. Allow it in the app's settings, then start the shift again.") },
            confirmButton = {
                TextButton(onClick = {
                    locationDenied = false
                    context.startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
                    )
                }) { Text("Open settings") }
            },
            dismissButton = { TextButton(onClick = { locationDenied = false }) { Text("Cancel") } },
        )
    }
    if (confirmEnd) {
        ConfirmDialog(
            title = "End shift?",
            text = "Recording stops and you can add what you earned.",
            confirm = "End shift",
            onConfirm = {
                change { a, now ->
                    a?.copy(pausedMs = a.pausedMs + (a.pausedAt?.let { now - it } ?: 0), pausedAt = null, endedAt = now)
                }
                nav.navigate("shift/finish")
            },
            onDismiss = { confirmEnd = false },
        )
    }
    if (confirmDiscard) {
        ConfirmDialog(
            title = "Discard this shift?",
            text = "The recorded time and distance will be deleted.",
            confirm = "Discard",
            onConfirm = { change { _, _ -> null } },
            onDismiss = { confirmDiscard = false },
        )
    }
}

@Composable
private fun ActiveShiftCard(shift: ActiveShift, onPause: () -> Unit, onResume: () -> Unit, onEnd: () -> Unit) {
    val now by produceState(System.currentTimeMillis(), shift.isPaused) {
        while (!shift.isPaused) {
            value = System.currentTimeMillis()
            delay(1000)
        }
    }
    Panel {
        Text(
            if (shift.isPaused) "Paused · ${shift.platform}" else "On shift · ${shift.platform}",
            style = MaterialTheme.typography.labelLarge,
            color = if (shift.isPaused) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary,
        )
        Money(clock(shift.workedMs(now) / 1000), style = MaterialTheme.typography.displayMedium)
        Money(km(shift.distanceM / 1000), style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            FilledTonalButton(
                shape = ButtonShape,
                onClick = if (shift.isPaused) onResume else onPause,
                modifier = Modifier.weight(1f).height(48.dp),
            ) { Text(if (shift.isPaused) "Resume" else "Pause") }
            Button(
                shape = ButtonShape,
                onClick = onEnd,
                modifier = Modifier.weight(1f).height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
            ) { Text("End shift") }
        }
    }
}

@Composable
private fun EndedShiftCard(shift: ActiveShift, onAddEarnings: () -> Unit, onDiscard: () -> Unit) {
    Panel {
        Text("Shift ended · ${shift.platform}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Money(
            "${duration(shift.workedMs(0) / 1000)} · ${km(shift.distanceM / 1000)}",
            style = MaterialTheme.typography.titleLarge,
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TextButton(onClick = onDiscard, modifier = Modifier.weight(1f)) { Text("Discard") }
            Button(shape = ButtonShape, onClick = onAddEarnings, modifier = Modifier.weight(1f)) { Text("Add earnings") }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PlatformDialog(platforms: List<String>, initial: String?, onDismiss: () -> Unit, onStart: (String) -> Unit) {
    var selected by remember { mutableStateOf(initial?.takeIf { it in platforms } ?: platforms.firstOrNull()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Start shift") },
        text = {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                platforms.forEach { platform ->
                    FilterChip(
                        selected = platform == selected,
                        onClick = { selected = platform },
                        label = { Text(platform) },
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { selected?.let(onStart) }, enabled = selected != null) { Text("Start") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
