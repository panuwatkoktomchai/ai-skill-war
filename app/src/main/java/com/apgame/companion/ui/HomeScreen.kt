// Home screen placeholder: large Thai text sized for older eyes.
package com.apgame.companion.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.apgame.companion.R
import com.apgame.companion.ui.theme.CompanionTheme

private val SCREEN_PADDING = 24.dp
private val TEXT_GAP = 16.dp

@Composable
fun HomeScreen(modifier: Modifier = Modifier) {
    Scaffold(modifier = modifier.fillMaxSize()) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(SCREEN_PADDING),
            verticalArrangement = Arrangement.spacedBy(TEXT_GAP, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stringResource(R.string.home_greeting),
                style = MaterialTheme.typography.headlineLarge
            )
            Text(
                text = stringResource(R.string.home_intro),
                style = MaterialTheme.typography.bodyLarge
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HomeScreenPreview() {
    CompanionTheme {
        HomeScreen()
    }
}
