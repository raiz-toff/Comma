package app.comma.tracker.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.comma.tracker.data.Expense
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ExpensesScreen(nav: NavController) {
    val app = app()
    val expenses by remember { app.dao.expenses().map { Loaded(it) } }.collectAsStateWithLifecycle(null)
    val months = remember(expenses) {
        expenses?.value.orEmpty().groupBy { YearMonth.from(it.date.toLocal()) }.toList()
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Expenses") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { nav.navigate("expense/new") }) {
                Icon(Icons.Filled.Add, contentDescription = "Add expense")
            }
        },
    ) { padding ->
        if (expenses?.value?.isEmpty() == true) {
            EmptyState("No expenses yet. Add fuel, insurance, phone and anything else the work costs you.", padding)
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 88.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                months.forEach { (month, rows) ->
                    stickyHeader(key = month.toString()) { MonthHeader(month) }
                    items(rows, key = { it.id }) { expense ->
                        Panel(onClick = { nav.navigate("expense/${expense.id}") }) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(categoryLabel(expense.category), style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        listOf(expense.date.toLocal().format(dayFormat), expense.note)
                                            .filter { it.isNotBlank() }.joinToString(" · "),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1,
                                    )
                                }
                                Money(money(expense.amount), style = MaterialTheme.typography.titleMedium)
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ExpenseEditScreen(nav: NavController, id: String) {
    val app = app()
    val existing = id != "new"

    var loaded by rememberSaveable { mutableStateOf(false) }
    var category by rememberSaveable { mutableStateOf("fuel") }
    var amount by rememberSaveable { mutableStateOf("") }
    var day by rememberSaveable { mutableStateOf(LocalDate.now().toEpochDay()) }
    var deductible by rememberSaveable { mutableStateOf("100") }
    var note by rememberSaveable { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (loaded) return@LaunchedEffect
        if (existing) app.dao.expense(id)?.let { e ->
            category = e.category
            amount = trimAmount(e.amount)
            day = e.date.toLocal().toLocalDate().toEpochDay()
            deductible = e.deductiblePct.toString()
            note = e.note
        }
        loaded = true
    }

    val amountValue = parseAmount(amount)
    val deductibleValue = deductible.toIntOrNull()?.takeIf { it in 0..100 }
    val valid = amountValue != null && amountValue > 0 && deductibleValue != null

    fun save() {
        val expense = Expense(
            id = if (existing) id else UUID.randomUUID().toString(),
            category = category,
            amount = amountValue ?: 0.0,
            // Noon keeps the expense on the same calendar day through clock changes.
            date = LocalDate.ofEpochDay(day).atTime(LocalTime.NOON).toMillis(),
            deductiblePct = deductibleValue ?: 100,
            note = note.trim(),
        )
        app.scope.launch { app.dao.saveExpense(expense) }
        nav.popBackStack()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (existing) "Edit expense" else "Add expense") },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (existing) {
                        IconButton(onClick = { confirmDelete = true }) {
                            Icon(Icons.Outlined.Delete, contentDescription = "Delete expense")
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
            AmountField("Amount", amount, { amount = it }, Modifier.fillMaxWidth())

            Text("Category", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CATEGORIES.forEach { item ->
                    FilterChip(
                        selected = item.id == category,
                        onClick = {
                            category = item.id
                            deductible = item.defaultDeductiblePct.toString()
                        },
                        label = { Text(item.label) },
                    )
                }
            }

            DateField("Date", LocalDate.ofEpochDay(day), { day = it.toEpochDay() }, Modifier.fillMaxWidth())
            OutlinedTextField(
                value = deductible,
                onValueChange = { text -> if (text.length <= 3 && text.all(Char::isDigit)) deductible = text },
                label = { Text("Business use") },
                suffix = { Text("%") },
                supportingText = { Text("The share of this cost that was for work. Only that share counts as deductible in Reports.") },
                isError = deductibleValue == null,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note") },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Delete this expense?",
            text = "This cannot be undone.",
            confirm = "Delete",
            onConfirm = {
                app.scope.launch { app.dao.deleteExpense(id) }
                nav.popBackStack()
            },
            onDismiss = { confirmDelete = false },
        )
    }
}
