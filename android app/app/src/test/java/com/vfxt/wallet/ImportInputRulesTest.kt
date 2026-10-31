package com.vfxt.wallet

import com.vfxt.wallet.ui.wallet.ImportInputRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ImportInputRulesTest {
    // Shape checks only: these words are not a valid BIP-39 checksum and are never used as a wallet.
    private val twelve = List(12) { "word" }.joinToString(" ")

    @Test
    fun phrase_acceptsTwelveAndTwentyFourWords() {
        assertTrue(ImportInputRules.isPhraseShapeValid(twelve))
        assertTrue(ImportInputRules.isPhraseShapeValid(List(24) { "word" }.joinToString(" ")))
    }

    @Test
    fun phrase_rejectsOtherCounts() {
        assertFalse(ImportInputRules.isPhraseShapeValid(List(11) { "word" }.joinToString(" ")))
        assertFalse(ImportInputRules.isPhraseShapeValid(List(18) { "word" }.joinToString(" ")))
    }

    @Test
    fun phrase_normalisesWhitespaceAndCase() {
        val messy = "  WORD\nword\tword " + List(9) { "word" }.joinToString("   ")
        assertEquals(12, ImportInputRules.words(messy).size)
        assertTrue(ImportInputRules.isPhraseShapeValid(messy))
    }

    @Test
    fun phrase_rejectsNonLetters() {
        assertFalse(ImportInputRules.isPhraseShapeValid(twelve.replaceFirst("word", "w0rd")))
    }

    @Test
    fun privateKey_acceptsHexWithOrWithoutPrefix() {
        val hex = "a".repeat(64)
        assertTrue(ImportInputRules.isPrivateKeyShapeValid(hex))
        assertTrue(ImportInputRules.isPrivateKeyShapeValid("0x$hex"))
    }

    @Test
    fun privateKey_rejectsWrongLengthOrCharacters() {
        assertFalse(ImportInputRules.isPrivateKeyShapeValid("a".repeat(63)))
        assertFalse(ImportInputRules.isPrivateKeyShapeValid("g".repeat(64)))
    }
}
