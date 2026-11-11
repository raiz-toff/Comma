package app.comma.tracker.ui

import java.text.NumberFormat
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Locale

private val currency = NumberFormat.getCurrencyInstance(Locale.CANADA)

fun money(value: Double): String = currency.format(value)

fun km(value: Double): String = String.format(Locale.CANADA, "%.1f km", value)

/** "3h 12m" */
fun duration(seconds: Long): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    return if (h > 0) "${h}h ${m}m" else "${m}m"
}

/** "03:12:45" */
fun clock(seconds: Long): String =
    String.format(Locale.CANADA, "%02d:%02d:%02d", seconds / 3600, (seconds % 3600) / 60, seconds % 60)

/** Earnings per hour worked, or a dash when there is too little time to say. */
fun perHour(total: Double, seconds: Long): String =
    if (seconds < 60) "–" else money(total / (seconds / 3600.0))

/** Parses what a driver types into an amount field; blank counts as zero. */
fun parseAmount(text: String): Double? =
    if (text.isBlank()) 0.0 else text.trim().replace(',', '.').toDoubleOrNull()?.takeIf { it >= 0 }

fun trimAmount(value: Double): String =
    if (value == 0.0) "" else String.format(Locale.US, "%.2f", value).trimEnd('0').trimEnd('.')

fun Long.toLocal(): LocalDateTime = Instant.ofEpochMilli(this).atZone(ZoneId.systemDefault()).toLocalDateTime()
fun LocalDateTime.toMillis(): Long = atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
fun LocalDate.startMillis(): Long = atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

val dayFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.CANADA)
val dayYearFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.CANADA)
val timeFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.CANADA)
val monthFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.CANADA)

enum class Span(val label: String) { WEEK("Week"), MONTH("Month"), YEAR("Year") }

/** A calendar week (Monday to Sunday), month or year. */
data class Period(val span: Span, val start: LocalDate) {
    val end: LocalDate
        get() = when (span) {
            Span.WEEK -> start.plusWeeks(1)
            Span.MONTH -> start.plusMonths(1)
            Span.YEAR -> start.plusYears(1)
        }
    val from: Long get() = start.startMillis()
    val to: Long get() = end.startMillis()

    fun step(n: Long): Period = copy(
        start = when (span) {
            Span.WEEK -> start.plusWeeks(n)
            Span.MONTH -> start.plusMonths(n)
            Span.YEAR -> start.plusYears(n)
        }
    )

    val title: String
        get() = when (span) {
            Span.WEEK -> {
                val last = end.minusDays(1)
                val short = DateTimeFormatter.ofPattern("MMM d", Locale.CANADA)
                "${start.format(short)} – ${last.format(dayYearFormat)}"
            }
            Span.MONTH -> start.format(monthFormat)
            Span.YEAR -> start.year.toString()
        }

    companion object {
        fun of(span: Span, date: LocalDate): Period = Period(
            span,
            when (span) {
                Span.WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                Span.MONTH -> date.withDayOfMonth(1)
                Span.YEAR -> date.withDayOfYear(1)
            },
        )
    }
}

/** Expense categories. The id is what gets stored; never rename one. */
data class Category(val id: String, val label: String, val defaultDeductiblePct: Int = 100)

val CATEGORIES = listOf(
    Category("fuel", "Fuel"),
    Category("maintenance", "Maintenance"),
    Category("insurance", "Insurance"),
    Category("licensing", "Licence & registration"),
    Category("financing", "Lease or loan"),
    // Mixed personal and business use, so these default to half.
    Category("phone", "Phone & data", 50),
    Category("parking", "Parking & tolls"),
    Category("wash", "Car wash"),
    Category("supplies", "Supplies"),
    Category("meals", "Meals", 50),
    Category("fees", "Fees"),
    Category("other", "Other"),
)

fun categoryLabel(id: String): String = CATEGORIES.firstOrNull { it.id == id }?.label ?: "Other"
