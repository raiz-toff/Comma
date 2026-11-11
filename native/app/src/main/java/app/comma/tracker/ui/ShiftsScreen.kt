package app.comma.tracker.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.comma.tracker.data.Shift
import kotlinx.coroutines.flow.map
import java.time.YearMonth

@Composable
fun ShiftRow(shift: Shift, onClick: () -> Unit) {
    val start = shift.startTime.toLocal()
    Panel(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(shift.platform, style = MaterialTheme.typography.titleMedium)
                Text(
                    "${start.format(dayFormat)} · ${duration(shift.workedSeconds)} · ${km(shift.distanceKm)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Money(money(shift.total), style = MaterialTheme.typography.titleMedium)
                Text(
                    "${perHour(shift.total, shift.workedSeconds)}/h",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun MonthHeader(month: YearMonth) {
    Text(
        month.atDay(1).format(monthFormat),
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
            .padding(vertical = 8.dp),
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
fun EmptyState(text: String, padding: PaddingValues) {
    Box(Modifier.fillMaxSize().padding(padding).padding(32.dp), contentAlignment = Alignment.Center) {
        Text(
            text,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ShiftsScreen(nav: NavController) {
    val app = app()
    val shifts by remember { app.dao.shifts().map { Loaded(it) } }.collectAsStateWithLifecycle(null)
    val months = remember(shifts) {
        shifts?.value.orEmpty().groupBy { YearMonth.from(it.startTime.toLocal()) }.toList()
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Shifts") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { nav.navigate("shift/new") }) {
                Icon(Icons.Filled.Add, contentDescription = "Add shift")
            }
        },
    ) { padding ->
        if (shifts?.value?.isEmpty() == true) {
            EmptyState("No shifts yet. Start one from Home, or add one you already worked with the + button.", padding)
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 88.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                months.forEach { (month, rows) ->
                    stickyHeader(key = month.toString()) { MonthHeader(month) }
                    items(rows, key = { it.id }) { shift -> ShiftRow(shift) { nav.navigate("shift/${shift.id}") } }
                }
            }
        }
    }
}
