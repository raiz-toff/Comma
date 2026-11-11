package app.comma.tracker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.comma.tracker.data.Shift
import app.comma.tracker.tracking.TrackingService
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import java.util.Locale
import java.util.UUID

/**
 * Add, edit or finish a shift. [id] is an existing shift's id, "new" for one typed in by
 * hand, or "finish" for the shift that was just tracked (times and distance prefilled).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ShiftEditScreen(nav: NavController, id: String) {
    val app = app()
    val finishing = id == "finish"
    val existing = id != "new" && !finishing
    val platforms by app.prefs.platforms.collectAsStateWithLifecycle()

    var loaded by rememberSaveable { mutableStateOf(false) }
    var platform by rememberSaveable { mutableStateOf("") }
    var day by rememberSaveable { mutableStateOf(LocalDate.now().toEpochDay()) }
    var startMinute by rememberSaveable { mutableStateOf(9 * 60) }
    var endMinute by rememberSaveable { mutableStateOf(17 * 60) }
    var breakMinutes by rememberSaveable { mutableStateOf("") }
    var pay by rememberSaveable { mutableStateOf("") }
    var tips by rememberSaveable { mutableStateOf("") }
    var distance by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (loaded) return@LaunchedEffect
        fun times(start: Long, end: Long) {
            val s = start.toLocal()
            day = s.toLocalDate().toEpochDay()
            startMinute = s.hour * 60 + s.minute
            endMinute = end.toLocal().let { it.hour * 60 + it.minute }
        }
        when {
            finishing -> app.dao.activeNow()?.let { a ->
                platform = a.platform
                times(a.startTime, a.endedAt ?: System.currentTimeMillis())
                breakMinutes = (a.pausedMs / 60_000).takeIf { it > 0 }?.toString().orEmpty()
                distance = String.format(Locale.US, "%.1f", a.distanceM / 1000)
            }
            existing -> app.dao.shift(id)?.let { s ->
                platform = s.platform
                times(s.startTime, s.endTime)
                breakMinutes = (s.pausedSeconds / 60).takeIf { it > 0 }?.toString().orEmpty()
                pay = trimAmount(s.pay)
                tips = trimAmount(s.tips)
                distance = trimAmount(s.distanceKm)
                notes = s.notes
            }
            else -> {
                platform = app.prefs.lastPlatform ?: platforms.firstOrNull().orEmpty()
                val now = LocalTime.now().truncatedTo(ChronoUnit.HOURS)
                endMinute = now.hour * 60
                startMinute = (endMinute - 240).coerceAtLeast(0)
            }
        }
        loaded = true
    }

    val payValue = parseAmount(pay)
    val tipsValue = parseAmount(tips)
    val distanceValue = parseAmount(distance)
    val valid = platform.isNotBlank() && payValue != null && tipsValue != null && distanceValue != null

    fun save() {
        val date = LocalDate.ofEpochDay(day)
        val start = LocalDateTime.of(date, LocalTime.of(startMinute / 60, startMinute % 60))
        // An end time at or before the start means the shift ran past midnight.
        val endDate = if (endMinute <= startMinute) date.plusDays(1) else date
        val end = LocalDateTime.of(endDate, LocalTime.of(endMinute / 60, endMinute % 60))
        val shift = Shift(
            id = if (existing) id else UUID.randomUUID().toString(),
            platform = platform,
            startTime = start.toMillis(),
            endTime = end.toMillis(),
            pausedSeconds = (breakMinutes.toLongOrNull() ?: 0) * 60,
            pay = payValue ?: 0.0,
            tips = tipsValue ?: 0.0,
            distanceKm = distanceValue ?: 0.0,
            notes = notes.trim(),
        )
        app.scope.launch { if (finishing) app.dao.finishShift(shift) else app.dao.saveShift(shift) }
        nav.popBackStack()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (finishing) "Finish shift" else if (existing) "Edit shift" else "Add shift") },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (existing || finishing) {
                        IconButton(onClick = { confirmDelete = true }) {
                            Icon(Icons.Outlined.Delete, contentDescription = if (finishing) "Discard shift" else "Delete shift")
                        }
                    }
                    TextButton(onClick = ::save, enabled = valid && loaded) { Text("Save") }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Platform", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Keep a platform that was since removed from the list selectable on old shifts.
                (platforms + platform).filter { it.isNotBlank() }.distinct().forEach { name ->
                    FilterChip(selected = name == platform, onClick = { platform = name }, label = { Text(name) })
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AmountField("Pay", pay, { pay = it }, Modifier.weight(1f))
                AmountField("Tips", tips, { tips = it }, Modifier.weight(1f))
            }

            DateField("Date", LocalDate.ofEpochDay(day), { day = it.toEpochDay() }, Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                TimeField("Start", LocalTime.of(startMinute / 60, startMinute % 60), { startMinute = it.hour * 60 + it.minute }, Modifier.weight(1f))
                TimeField("End", LocalTime.of(endMinute / 60, endMinute % 60), { endMinute = it.hour * 60 + it.minute }, Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = breakMinutes,
                    onValueChange = { text -> if (text.length <= 4 && text.all(Char::isDigit)) breakMinutes = text },
                    label = { Text("Breaks (min)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
                AmountField("Distance (km)", distance, { distance = it }, Modifier.weight(1f), prefix = null)
            }
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
            )
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = if (finishing) "Discard this shift?" else "Delete this shift?",
            text = "This cannot be undone.",
            confirm = if (finishing) "Discard" else "Delete",
            onConfirm = {
                app.scope.launch {
                    if (finishing) {
                        app.dao.clearActive()
                        TrackingService.sync(app)
                    } else {
                        app.dao.deleteShift(id)
                    }
                }
                nav.popBackStack()
            },
            onDismiss = { confirmDelete = false },
        )
    }
}
