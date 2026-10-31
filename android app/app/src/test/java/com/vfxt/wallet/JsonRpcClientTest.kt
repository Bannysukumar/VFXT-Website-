package com.vfxt.wallet

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.rpc.JsonRpcClient
import com.vfxt.wallet.blockchain.rpc.NetworkUnavailableException
import com.vfxt.wallet.blockchain.rpc.RpcException
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class JsonRpcClientTest {
    private lateinit var good: MockWebServer
    private lateinit var wrongChain: MockWebServer

    @Before
    fun setUp() {
        good = MockWebServer().apply { start() }
        wrongChain = MockWebServer().apply { start() }
    }

    @After
    fun tearDown() {
        good.close()
        wrongChain.close()
    }

    private fun result(value: String) = MockResponse.Builder()
        .body("""{"jsonrpc":"2.0","id":1,"result":"$value"}""")
        .build()

    private fun network(vararg urls: String) = EvmNetwork(
        id = "test", name = "Test", shortName = "T", chainId = 97, nativeSymbol = "tBNB", nativeName = "Test BNB",
        nativeDecimals = 18, isTestnet = true, explorerBaseUrl = "https://example.com", rpcUrls = urls.toList(), nativePriceId = null,
    )

    @Test
    fun skipsEndpointReportingWrongChainAndUsesNextOne() = runBlocking {
        wrongChain.enqueue(result("0x38")) // chain 56, but we expect 97
        good.enqueue(result("0x61")) // chain id check
        good.enqueue(result("0x1234")) // actual call
        val client = JsonRpcClient(OkHttpClient())
        val value = client.call(network(wrongChain.url("/").toString(), good.url("/").toString()), "eth_blockNumber", JsonArray(emptyList()))
        assertEquals("0x1234", value.jsonPrimitive.content)
    }

    @Test
    fun nodeErrorsAreSurfacedNotRetried() = runBlocking {
        good.enqueue(result("0x61"))
        good.enqueue(MockResponse.Builder().body("""{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"insufficient funds for gas"}}""").build())
        val client = JsonRpcClient(OkHttpClient())
        try {
            client.call(network(good.url("/").toString()), "eth_sendRawTransaction", JsonArray(emptyList()))
            fail("Expected RpcException")
        } catch (e: RpcException) {
            assertTrue(e.message.contains("insufficient funds"))
        }
    }

    @Test
    fun allEndpointsFailingRaisesNetworkUnavailable() = runBlocking {
        wrongChain.enqueue(result("0x38"))
        val client = JsonRpcClient(OkHttpClient())
        try {
            client.call(network(wrongChain.url("/").toString()), "eth_blockNumber", JsonArray(emptyList()))
            fail("Expected NetworkUnavailableException")
        } catch (_: NetworkUnavailableException) {
        }
    }
}
