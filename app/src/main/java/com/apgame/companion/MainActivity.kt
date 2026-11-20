// App entry point: shows the home screen inside the app theme.
package com.apgame.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.apgame.companion.ui.HomeScreen
import com.apgame.companion.ui.theme.CompanionTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CompanionTheme {
                HomeScreen()
            }
        }
    }
}
