using System;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Diagnostics;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
 
namespace Simplify_B1.Plugins
{
    public class SearchProductsFromApi : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(context.UserId);
            var stopwatch = Stopwatch.StartNew();
            tracing.Trace("===== 🔵 Plugin Start: SearchProductsFromApi =====");
            tracing.Trace($"Message: {context.MessageName}");
 
            tracing.Trace($"UserId: {context.UserId}");
 
            tracing.Trace($"CorrelationId: {context.CorrelationId}");
 
            try
 
            {
 
                // 🔹 INPUTS (FIXED NAMES)
 
                string email = context.InputParameters.Contains("sb1_email_request") ? (string)context.InputParameters["sb1_email_request"] : "";
 
                string question = context.InputParameters.Contains("sb1_question_request") ? (string)context.InputParameters["sb1_question_request"] : "";
 
                string prefilter = context.InputParameters.Contains("sb1_prefilter_request") ? (string)context.InputParameters["sb1_prefilter_request"] : "";
 
                tracing.Trace($"[INPUT] Email: {email}");
 
                tracing.Trace($"[INPUT] Question: {question}");
 
                tracing.Trace($"[INPUT] Prefilter: {prefilter}");
 
                // 🔹 TOKEN FETCH
 
                tracing.Trace("➡️ Fetching Access Token...");
 
                var query = new QueryExpression("sb1_bannyapitoken")
 
                {
 
                    ColumnSet = new ColumnSet("sb1_accesstoken"),
 
                    TopCount = 1
 
                };
 
                var tokenEntity = service.RetrieveMultiple(query).Entities.FirstOrDefault();
 
                if (tokenEntity == null)
 
                {
 
                    tracing.Trace("❌ No token record found");
 
                    throw new InvalidPluginExecutionException("Token not found");
 
                }
 
                string token = tokenEntity.GetAttributeValue<string>("sb1_accesstoken");
 
                tracing.Trace($"✅ Token retrieved (length): {token?.Length}");
 
                // 🔹 ENV VARIABLES
 
                tracing.Trace("➡️ Fetching Environment Variables...");
 
                string apiUrl = GetEnv(service, "sb1_bniproductsearchapi");
 
                string tenantId = GetEnv(service, "sb1_tenantid");
 
                tracing.Trace($"API URL: {apiUrl}");
 
                tracing.Trace($"TenantId: {tenantId}");
 
                if (string.IsNullOrEmpty(apiUrl))
 
                    throw new Exception("API URL missing");
 
                // 🔹 API CALL
 
 
                tracing.Trace("➡️ Calling External API...");
 
                var apiWatch = Stopwatch.StartNew();
 
                string response = CallApi(apiUrl, email, question, token, tenantId, tracing);
 
                apiWatch.Stop();
 
                tracing.Trace($"⏱ API Call Duration: {apiWatch.ElapsedMilliseconds} ms");
 
                if (string.IsNullOrEmpty(response))
 
                {
 
                    tracing.Trace("❌ Empty API response");
 
                    context.OutputParameters["sb1_products_response"] = "[]";
 
                    return;
 
                }
 
                tracing.Trace("📦 RAW RESPONSE:");
 
                tracing.Trace(response.Length > 2000 ? response.Substring(0, 2000) + "..." : response);
 
                // 🔹 PARSE JSON
 
                tracing.Trace("➡️ Parsing JSON...");
 
                JObject parsed = JObject.Parse(response);
 
                JToken data =
 
                    parsed["Result"]?["Data"] ??
 
                    parsed["result"]?["data"] ??
 
                    parsed["data"] ??
 
                    parsed["items"];
 
                if (data == null)
 
                {
 
                    tracing.Trace("❌ Data node not found in response");
 
                    context.OutputParameters["sb1_products_response"] = "[]";
 
                    return;
 
                }
 
                tracing.Trace($"📊 Records received: {data.Count()}");
 
                // 🔹 FILTER
 
                tracing.Trace("➡️ Filtering records (remove 'package')...");
 
                var filtered = data
 
                    .Where(x => !(x["ProductType"]?.ToString()?.ToLower().Contains("package") ?? false))
 
                    .ToList();
 
                tracing.Trace($"📊 After filter count: {filtered.Count}");
 
                // 🔹 SELECT
 
                tracing.Trace("➡️ Transforming data...");
 
                var result = filtered.Select(x => new ProductRequest
                {
                    FormInstanceID = x["FormInstanceID"]?.ToString(),
                    AnchorDocumentID = x["AnchorDocumentID"]?.ToObject<long?>(),
 
                    version = x["version"]?.ToString(),
                    PlanStatus = x["PlanStatus"]?.ToString(),
 
                    folder_effective_date = x["folder_effective_date"]?.ToString(),
                    folder_name = x["folder_name"]?.ToString()?.Trim(),
 
                    Module = x["Module"]?.ToString(),
 
                    // 🔥 FIX: Trim + fallback
                    ProductName = x["ProductName"]?.ToString()?.Trim(),
 
                    ProductType = x["ProductType"]?.ToString(),
 
                    // 🔥 FIX: null handling
                    TypeOfPlan = x["TypeOfPlan"]?.ToString() ?? "NA",
 
                    MarketSegment = x["MarketSegment"]?.ToString(),
                    FundingArrangement = x["FundingArrangement"]?.ToString(),
 
                    PlanEffectiveDate = x["PlanEffectiveDate"]?.ToString(),
 
                    PlanToBeSoldInState = x["PlanToBeSoldInState"]?.ToString(),
 
                    BenefitPeriod = x["BenefitPeriod"]?.ToString() ?? "NA",
                    DeductibleOptions = x["DeductibleOptions"]?.ToString() ?? "NA",
                    OOPMOptions = x["OOPMOptions"]?.ToString() ?? "NA",
 
                    IsGrandfatheredPlan = x["IsGrandfatheredPlan"]?.ToString(),
                    IsChurchPlan = x["IsChurchPlan"]?.ToString(),
                    IsCOBRAPlan = x["IsCOBRAPlan"]?.ToString(),
 
                    FoundationTemplate = x["FoundationTemplate"]?.ToString()
                }).ToList();
 
                tracing.Trace($"📊 Final result count: {result.Count}");
 
                // 🔹 CONDITIONAL LOGIC
 
                bool isPrefilterYes = prefilter?.ToLower().Contains("yes") == true;
 
                bool isSpecialQuestion = question?.ToLower().Contains("give me dental vision rx and medical products") == true;
 
                tracing.Trace($"Prefilter YES: {isPrefilterYes}");
 
                tracing.Trace($"Special Question Match: {isSpecialQuestion}");
 
                if (isPrefilterYes || isSpecialQuestion)
 
                {
 
                    tracing.Trace("⚡ Applying TOP 500 limit");
 
                    result = result.Take(500).ToList();
 
                }
 
                // 🔹 OUTPUT
 
                string finalJson = JsonConvert.SerializeObject(result);
 
                tracing.Trace($"📤 Output size: {finalJson.Length} chars");
 
                context.OutputParameters["sb1_products_response"] = finalJson;
 
                stopwatch.Stop();
 
                tracing.Trace($"===== ✅ Plugin End | Total Time: {stopwatch.ElapsedMilliseconds} ms =====");
 
            }
 
            catch (Exception ex)
 
            {
 
                tracing.Trace("💥 ERROR OCCURRED:");
 
                tracing.Trace(ex.ToString());
 
                throw new InvalidPluginExecutionException("SearchProductsPlugin Failed: " + ex.Message);
 
            }
 
        }
 
        private string CallApi(string url, string email, string question, string token, string tenantId, ITracingService trace)
 
        {
 
            using (var client = new HttpClient())
 
            {
 
                client.Timeout = TimeSpan.FromSeconds(30);
 
                client.DefaultRequestHeaders.Add("email", email);
 
                client.DefaultRequestHeaders.Add("applicationName", "commercial");
 
                client.DefaultRequestHeaders.Add("user_role_name", "Simplify SuperUser");
 
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
 
                client.DefaultRequestHeaders.Add("tenant_id", tenantId);
 
                var body = new
                {
                    question,
                    page_no = 1,
                    page_size = 500
                };
 
                string jsonBody = JsonConvert.SerializeObject(body);
 
                var content = new StringContent(
                    jsonBody,
                    Encoding.UTF8,
                    "application/json"
                );
 
                trace.Trace("📡 Sending HTTP POST...");
 
                trace.Trace(jsonBody);
 
 
                var res = client.PostAsync(url, content).Result;
 
                trace.Trace($"HTTP Status: {res.StatusCode}");
 
                return res.Content.ReadAsStringAsync().Result;
 
            }
 
        }
 
        private string GetEnv(IOrganizationService service, string name)
 
        {
 
            var def = service.RetrieveMultiple(new QueryExpression("environmentvariabledefinition")
 
            {
 
                ColumnSet = new ColumnSet("environmentvariabledefinitionid"),
 
                Criteria =
 
                {
 
                    Conditions =
 
                    {
 
                        new ConditionExpression("schemaname", ConditionOperator.Equal, name)
 
                    }
 
                }
 
            }).Entities.FirstOrDefault();
 
            if (def == null) return null;
 
            var val = service.RetrieveMultiple(new QueryExpression("environmentvariablevalue")
 
            {
 
                ColumnSet = new ColumnSet("value"),
 
                Criteria =
 
                {
 
                    Conditions =
 
                    {
 
                        new ConditionExpression("environmentvariabledefinitionid", ConditionOperator.Equal, def.Id)
 
                    }
 
                }
 
            }).Entities.FirstOrDefault();
 
            return val?.GetAttributeValue<string>("value");
 
        }
 
    }
 
}