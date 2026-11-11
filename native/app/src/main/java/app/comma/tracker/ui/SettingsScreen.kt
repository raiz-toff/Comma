package app.comma.tracker.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.comma.tracker.BuildConfig
import app.comma.tracker.data.Backup
import app.comma.tracker.drive.Drive
import app.comma.tracker.drive.NeedsSignIn
import app.comma.tracker.drive.RemoteBackup
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val stamp = DateTimeFormatter.ofPattern("MMM d, yyyy 'at' h:mm a", Locale.CANADA)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(nav: NavController) {
    val app = app()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = LocalSnackbar.current

    val theme by app.prefs.theme.collectAsStateWithLifecycle()
    val platforms by app.prefs.platforms.collectAsStateWithLifecycle()
    val connected by app.prefs.driveConnected.collectAsStateWithLifecycle()
    val lastBackupAt by app.prefs.lastBackupAt.collectAsStateWithLifecycle()
    val backupError by app.prefs.backupError.collectAsStateWithLifecycle()

    var newPlatform by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var afterSignIn by remember { mutableStateOf<(() -> Unit)?>(null) }
    var found by remember { mutableStateOf<RemoteBackup?>(null) }
    var importFrom by remember { mutableStateOf<Uri?>(null) }

    fun say(message: String) {
        scope.launch { snackbar.showSnackbar(message) }
    }

    val signIn = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
        val next = afterSignIn
        afterSignIn = null
        try {
            Drive.completeSignIn(context, result.data)
            next?.invoke()
        } catch (e: Exception) {
            say("Google Drive was not connected.")
        }
    }

    /** Runs a Drive action, sending the driver through Google's sign-in first if needed. */
    fun drive(action: suspend () -> Unit) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                action()
            } catch (e: NeedsSignIn) {
                afterSignIn = { drive(action) }
                signIn.launch(IntentSenderRequest.Builder(e.intent.intentSender).build())
            } catch (e: Exception) {
                say(e.message ?: "Something went wrong.")
            } finally {
                busy = false
            }
        }
    }

    val exportFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) scope.launch {
            try {
                val bytes = Backup.export(app)
                withContext(Dispatchers.IO) {
                    context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                        ?: error("Could not write to that location.")
                }
                say("Backup file saved.")
            } catch (e: Exception) {
                say(e.message ?: "Could not save the file.")
            }
        }
    }
    val pickFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> importFrom = uri }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
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
            SectionTitle("Google Drive backup")
            Panel {
                if (!connected) {
                    Text(
                        "Keep a copy of your shifts and expenses in your own Google Drive. It goes into a private app folder that only Comma can read, and is updated automatically after you change something.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(
                shape = ButtonShape,
                        enabled = !busy,
                        onClick = {
                            drive {
                                val remote = Drive.latest(app)
                                app.prefs.setDriveConnected(true)
                                when {
                                    remote != null -> found = remote
                                    app.dao.rowCountNow() > 0 -> {
                                        Drive.backupNow(app)
                                        say("Connected and backed up.")
                                    }
                                    else -> say("Connected to Google Drive.")
                                }
                            }
                        },
                    ) { Text("Connect Google Drive") }
                } else {
                    Text(
                        if (lastBackupAt > 0) "Last backup ${lastBackupAt.toLocal().format(stamp)}" else "Connected. Nothing backed up yet.",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    backupError?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(
                shape = ButtonShape,
                            enabled = !busy,
                            onClick = {
                                drive {
                                    Drive.backupNow(app)
                                    say("Backed up to Google Drive.")
                                }
                            },
                        ) { Text("Back up now") }
                        OutlinedButton(
                shape = ButtonShape,
                            enabled = !busy,
                            onClick = { drive { found = Drive.latest(app) ?: error("There is no backup on Google Drive yet.") } },
                        ) { Text("Restore") }
                    }
                    TextButton(
                        enabled = !busy,
                        onClick = {
                            app.prefs.setDriveConnected(false)
                            app.prefs.setBackupError(null)
                        },
                    ) { Text("Disconnect") }
                }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp))
            }

            SectionTitle("Backup file")
            Panel {
                Text(
                    "Save everything to a file, or load a file you saved before. Works without Google Drive.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(shape = ButtonShape, onClick = { exportFile.launch("comma-backup-${LocalDate.now()}.json") }) { Text("Save to file") }
                    OutlinedButton(shape = ButtonShape, onClick = { pickFile.launch(arrayOf("application/json", "application/octet-stream", "text/plain")) }) { Text("Load from file") }
                }
            }

            SectionTitle("Platforms")
            Panel {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    platforms.forEach { name ->
                        InputChip(
                            selected = false,
                            onClick = {},
                            label = { Text(name) },
                            trailingIcon = {
                                // The last platform cannot be removed: a shift needs one.
                                if (platforms.size > 1) {
                                    IconButton(onClick = { app.prefs.setPlatforms(platforms - name) }, modifier = Modifier.height(24.dp)) {
                                        Icon(Icons.Filled.Close, contentDescription = "Remove $name")
                                    }
                                }
                            },
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = newPlatform,
                        onValueChange = { newPlatform = it.take(30) },
                        label = { Text("Add a platform") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    val name = newPlatform.trim()
                    TextButton(
                        enabled = name.isNotEmpty() && platforms.none { it.equals(name, ignoreCase = true) },
                        onClick = {
                            app.prefs.setPlatforms(platforms + name)
                            newPlatform = ""
                        },
                    ) { Text("Add") }
                }
            }

            SectionTitle("Appearance")
            val themes = listOf("system" to "System", "light" to "Light", "dark" to "Dark")
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                themes.forEachIndexed { index, (value, label) ->
                    SegmentedButton(
                        selected = theme == value,
                        onClick = { app.prefs.setTheme(value) },
                        shape = SegmentedButtonDefaults.itemShape(index, themes.size),
                    ) { Text(label) }
                }
            }

            Text(
                "Comma ${BuildConfig.VERSION_NAME}",
                Modifier.fillMaxWidth().padding(top = 16.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    found?.let { remote ->
        AlertDialog(
            onDismissRequest = { found = null },
            title = { Text("Restore from Google Drive?") },
            text = {
                Text(
                    "There is a backup from ${remote.modifiedAt.toLocal().format(stamp)}. Restoring replaces every shift and expense on this phone with it.\n\n" +
                        "If you keep this phone's data instead, the next backup replaces the one on Drive."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    found = null
                    drive {
                        val snapshot = Drive.restore(app, remote)
                        say("Restored ${snapshot.shifts.size} shifts and ${snapshot.expenses.size} expenses.")
                    }
                }) { Text("Restore") }
            },
            dismissButton = { TextButton(onClick = { found = null }) { Text("Keep this phone's data") } },
        )
    }

    importFrom?.let { uri ->
        ConfirmDialog(
            title = "Load this backup file?",
            text = "It replaces every shift and expense on this phone.",
            confirm = "Load",
            onConfirm = {
                scope.launch {
                    try {
                        val bytes = withContext(Dispatchers.IO) {
                            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                                ?: error("Could not read that file.")
                        }
                        val snapshot = Backup.restore(app, bytes)
                        say("Loaded ${snapshot.shifts.size} shifts and ${snapshot.expenses.size} expenses.")
                    } catch (e: Exception) {
                        say(e.message ?: "Could not load that file.")
                    }
                }
            },
            onDismiss = { importFrom = null },
        )
    }
}
