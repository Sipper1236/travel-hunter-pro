import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshAirCanada, searchAirCanada } from '../lib/air-canada.mjs';

const query = { origin: 'YHZ', destination: 'BCN', date: '2099-04-15', adults: 1, children: 0, cabin: 'economy' };
const options = { apiKey: 'ac-test-key', sellerId: 'seller-test', iataNumber: '12345678', agencyId: 'agency-test' };
const soap = payload => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><ACNDC:NDCMSG_Envelope xmlns:ACNDC="https://prod.services.atpco.net/ndcexchange/NDC/schema/v1"><NDCMSG_Body><NDCMSG_Payload><![CDATA[${payload}]]></NDCMSG_Payload></NDCMSG_Body></ACNDC:NDCMSG_Envelope></soapenv:Body></soapenv:Envelope>`;
const shoppingResponse = soap(`<AirShoppingRS xmlns="http://www.iata.org/IATA/EDIST/2017.2"><ShoppingResponseID><ResponseID>resp-1</ResponseID></ShoppingResponseID><OffersGroup><AirlineOffers><Offer OfferID="offer-1" Owner="AC"><OfferItem OfferItemID="item-1"><TotalPriceDetail><TotalAmount><SimpleCurrencyPrice Code="CAD">850.50</SimpleCurrencyPrice></TotalAmount></TotalPriceDetail><FareDetail><FareComponent><SegmentRefs>seg-1 seg-2</SegmentRefs><CabinType><CabinTypeCode>Y</CabinTypeCode></CabinType></FareComponent></FareDetail></OfferItem></Offer></AirlineOffers></OffersGroup><DataLists><PaxSegmentList><PaxSegment PaxSegmentID="seg-1"><Dep><AirportCode>YHZ</AirportCode><Date>2099-04-15</Date><Time>08:00</Time></Dep><Arrival><AirportCode>YYZ</AirportCode><Date>2099-04-15</Date><Time>10:00</Time></Arrival><MarketingCarrierInfo><CarrierDesigCode>AC</CarrierDesigCode><MarketingCarrierFlightNumberText>123</MarketingCarrierFlightNumberText></MarketingCarrierInfo></PaxSegment><PaxSegment PaxSegmentID="seg-2"><Dep><AirportCode>YYZ</AirportCode><Date>2099-04-15</Date><Time>12:00</Time></Dep><Arrival><AirportCode>BCN</AirportCode><Date>2099-04-16</Date><Time>08:00</Time></Arrival><MarketingCarrierInfo><CarrierDesigCode>AC</CarrierDesigCode><MarketingCarrierFlightNumberText>456</MarketingCarrierFlightNumberText></MarketingCarrierInfo></PaxSegment></PaxSegmentList></DataLists></AirShoppingRS>`);

test('Air Canada NDC builds a versioned AirShopping SOAP envelope and normalizes only linked priced segments', async () => {
  let request;
  const result = await searchAirCanada(query, { ...options, fetcher: async (url, init) => {
    request = { url: String(url), init };
    return new Response(shoppingResponse, { headers: { 'Content-Type': 'application/xml' } });
  } });
  assert.equal(request.url, 'https://ndcpartners.aircanada.com/agg/ndc/17.2/v1/AirShopping');
  assert.equal(request.init.headers['x-api-key'], 'ac-test-key');
  assert.match(request.init.body, /<SellerID>seller-test<\/SellerID>/);
  assert.match(request.init.body, /<IATA_Number>12345678<\/IATA_Number>/);
  assert.match(request.init.body, /<AirportCode>YHZ<\/AirportCode>/);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].price, 850.5);
  assert.equal(result.offers[0].via[0], 'YYZ');
  assert.deepEqual(result.offers[0].airCanadaOffer, { offerId: 'offer-1', offerItemId: 'item-1', responseId: 'resp-1', owner: 'AC' });
});

test('Air Canada OfferPrice refreshes the selected NDC offer without booking', async () => {
  let request;
  const result = await refreshAirCanada({ ...query, airCanadaOffer: { offerId: 'offer-1', offerItemId: 'item-1', responseId: 'resp-1', owner: 'AC' } }, {
    ...options, fetcher: async (url, init) => {
      request = { url: String(url), body: init.body };
      return new Response(soap('<OfferPriceRS><PricedOffer><TotalPrice><DetailCurrencyPrice><Total Code="CAD">875.25</Total></DetailCurrencyPrice></TotalPrice></PricedOffer></OfferPriceRS>'), { headers: { 'Content-Type': 'application/xml' } });
    },
  });
  assert.equal(request.url, 'https://ndcpartners.aircanada.com/agg/ndc/17.2/v1/OfferPrice');
  assert.match(request.body, /OfferID="offer-1"/);
  assert.equal(result.status, 'refreshed');
  assert.equal(result.price, 875.25);
  assert.match(result.limitation, /not a ticket/);
});

test('Air Canada refuses unsupported party inputs and missing onboarding credentials', async () => {
  await assert.rejects(searchAirCanada({ ...query, adults: 2 }, { ...options, fetcher: () => { throw Error('must not fetch'); } }), /one adult/);
  await assert.rejects(searchAirCanada(query, { apiKey: '', fetcher: () => { throw Error('must not fetch'); } }), /issued API key/);
});
