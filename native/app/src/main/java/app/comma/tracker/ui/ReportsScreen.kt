package app.comma.tracker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen() {
    val app = app()
    var span by rememberSaveable { mutableStateOf(Span.WEEK) }
    var offset by rememberSaveable { mutableStateOf(0L) }
    val today = LocalDate.now()
    val period = remember(span, offset, today) { Period.of(span, today).step(offset) }

    val shifts by remember(period) { app.dao.shiftTotals(period.from, period.to) }.collectAsStateWithLifecycle(null)
    val costs by remember(period) { app.dao.expenseTotals(period.from, period.to) }.collectAsStateWithLifecycle(null)
    val platforms by remember(period) { app.dao.platformTotals(period.from, period.to) }.collectAsStateWithLifecycle(emptyList())
    val categories by remember(period) { app.dao.categoryTotals(period.from, period.to) }.collectAsStateWithLifecycle(emptyList())
    val buckets by remember(period) {
        app.dao.earningsBuckets(if (period.span == Span.YEAR) "%m" else "%Y-%m-%d", period.from, period.to)
    }.collectAsStateWithLifecycle(emptyList())

    val earned = shifts?.total ?: 0.0
    val seconds = shifts?.seconds ?: 0
    val distance = shifts?.km ?: 0.0
    val spent = costs?.total ?: 0.0

    Scaffold(topBar = { TopAppBar(title = { Text("Reports") }) }) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                Span.entries.forEachIndexed { index, item ->
                    SegmentedButton(
                        selected = span == item,
                        onClick = {
                            span = item
                            offset = 0
                        },
                        shape = SegmentedButtonDefaults.itemShape(index, Span.entries.size),
                    ) { Text(item.label) }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { offset-- }) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Earlier")
                }
                Text(period.title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
                IconButton(onClick = { offset++ }, enabled = offset < 0) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Later")
                }
            }

            Panel {
                Text("Earned", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Money(money(earned), style = MaterialTheme.typography.displaySmall)
                Spacer(Modifier.height(16.dp))
                Bars(period, buckets.associate { it.name to it.total })
                Spacer(Modifier.height(16.dp))
                Row(Modifier.fillMaxWidth()) {
                    Stat("Pay", money(shifts?.pay ?: 0.0), Modifier.weight(1f))
                    Stat("Tips", money(shifts?.tips ?: 0.0), Modifier.weight(1f))
                    Stat("Shifts", (shifts?.count ?: 0).toString(), Modifier.weight(1f))
                }
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth()) {
                    Stat("Hours", duration(seconds), Modifier.weight(1f))
                    Stat("Per hour", perHour(earned, seconds), Modifier.weight(1f))
                    Stat("Distance", km(distance), Modifier.weight(1f))
                }
            }

            Panel {
                Line("Earned", money(earned))
                Line("Expenses", money(spent))
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                Line("Left after expenses", money(earned - spent), strong = true)
                Spacer(Modifier.height(8.dp))
                Line("Deductible share of expenses", money(costs?.deductible ?: 0.0), muted = true)
            }

            if (platforms.isNotEmpty()) {
                Panel {
                    Text("By platform", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    platforms.forEach { Line("${it.name} · ${duration(it.seconds)}", money(it.total)) }
                }
            }
            if (categories.isNotEmpty()) {
                Panel {
                    Text("Expenses by category", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    categories.forEach { Line(categoryLabel(it.name), money(it.total)) }
                }
            }
        }
    }
}

@Composable
private fun Line(label: String, value: String, strong: Boolean = false, muted: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            label,
            Modifier.weight(1f),
            style = if (strong) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            color = if (muted) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
        )
        Money(value, style = if (strong) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium)
    }
}

/** One bar per day (week, month) or per month (year). The sums come from SQLite. */
@Composable
private fun Bars(period: Period, totals: Map<String, Double>) {
    val key = DateTimeFormatter.ISO_LOCAL_DATE
    val bars: List<Pair<String, Double>> = remember(period, totals) {
        when (period.span) {
            Span.WEEK -> (0L..6L).map { period.start.plusDays(it) }.map {
                it.dayOfWeek.getDisplayName(TextStyle.NARROW, Locale.CANADA) to (totals[it.format(key)] ?: 0.0)
            }
            Span.MONTH -> (0 until period.start.lengthOfMonth()).map { period.start.plusDays(it.toLong()) }.map {
                (if (it.dayOfMonth % 7 == 1) it.dayOfMonth.toString() else "") to (totals[it.format(key)] ?: 0.0)
            }
            Span.YEAR -> (0L..11L).map { period.start.plusMonths(it) }.map {
                it.month.getDisplayName(TextStyle.NARROW, Locale.CANADA) to
                    (totals[String.format(Locale.US, "%02d", it.monthValue)] ?: 0.0)
            }
        }
    }
    val max = bars.maxOf { it.second }.takeIf { it > 0 } ?: 1.0
    val gap = if (bars.size > 12) 2.dp else 6.dp
    Column {
        Row(Modifier.fillMaxWidth().height(96.dp), horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.Bottom) {
            bars.forEach { (_, value) ->
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight((value / max).toFloat().coerceIn(0.02f, 1f))
                        .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                        .background(if (value > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainerHighest)
                )
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(gap)) {
            bars.forEach { (label, _) ->
                Text(
                    label,
                    Modifier.weight(1f),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    softWrap = false,
                )
            }
        }
    }
}
