package app.comma.tracker.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.comma.tracker.CommaApp
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset

val LocalSnackbar = staticCompositionLocalOf<SnackbarHostState> { error("No snackbar host") }

@Composable
fun app(): CommaApp = LocalContext.current.applicationContext as CommaApp

/** A value that has finished loading, so "still loading" and "loaded, nothing there" differ. */
data class Loaded<T>(val value: T)

/** Comma's card: a surface step and a hairline border, never a shadow. */
@Composable
fun Panel(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            Modifier
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(16.dp),
            content = content,
        )
    }
}

@Composable
fun Money(
    value: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyLarge,
) {
    Text(value, modifier, style = style.copy(fontWeight = FontWeight.SemiBold, fontFeatureSettings = "tnum"))
}

@Composable
fun Stat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Money(value, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        modifier.padding(top = 8.dp),
        style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 0.6.sp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
fun AmountField(label: String, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, prefix: String? = "$") {
    OutlinedTextField(
        value = value,
        onValueChange = { text -> if (text.all { it.isDigit() || it == '.' || it == ',' }) onChange(text) },
        label = { Text(label) },
        prefix = prefix?.let { { Text(it) } },
        singleLine = true,
        isError = parseAmount(value) == null,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = modifier,
    )
}

/** A read-only field that opens a picker when tapped. */
@Composable
private fun PickerField(label: String, text: String, modifier: Modifier, onClick: () -> Unit) {
    Box(modifier) {
        OutlinedTextField(
            value = text,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            label = { Text(label) },
            modifier = Modifier.fillMaxWidth(),
        )
        Box(Modifier.matchParentSize().clickable(onClick = onClick))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(label: String, date: LocalDate, onChange: (LocalDate) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    PickerField(label, date.format(dayYearFormat), modifier) { open = true }
    if (open) {
        // The Material date picker works in UTC midnights.
        val state = rememberDatePickerState(
            initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        )
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let {
                        onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate())
                    }
                    open = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Cancel") } },
        ) { DatePicker(state) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimeField(label: String, time: LocalTime, onChange: (LocalTime) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    PickerField(label, time.format(timeFormat), modifier) { open = true }
    if (open) {
        val state = rememberTimePickerState(initialHour = time.hour, initialMinute = time.minute)
        AlertDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    onChange(LocalTime.of(state.hour, state.minute))
                    open = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Cancel") } },
            text = { TimePicker(state) },
        )
    }
}

@Composable
fun ConfirmDialog(
    title: String,
    text: String,
    confirm: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = {
            TextButton(onClick = {
                onDismiss()
                onConfirm()
            }) { Text(confirm) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
