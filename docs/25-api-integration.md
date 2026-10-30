# 初程业务API接入约定 v1（客户端预留）

## 当前状态

src/services提供可配置的客户端及严格类型/响应校验。当前没有业务后端，也没有接入在线LLM、OCR、RAG或Agent。现有八项工具仍走原本地规则，不会因为放入这些文件而自动上传材料。API客户端尚未接到产品的业务提交按钮。

.env.example只有公开后端地址VITE_API_BASE_URL，默认为空。开发者可复制为忽略提交的.env.local，在后端真正完成后配置；API地址带版本前缀，例如/api/v1。相对路径需要反向代理；当前Vite和本地预览没有伪造这组接口。开发也可填自己的后端绝对URL，并由后端设置CORS。模型密钥、私有令牌必须保存在服务端，不能放入VITE_*变量。

## 已预留的客户端方法

|方法|HTTP路径（相对baseUrl）|说明|
|---|---|---|
|getCapabilities(signal?)|GET /capabilities|读取schemaVersion=1、支持的八事务ID及documentReview/ocr/rag/agent布尔状态|
|reviewDocument(input, consent)|POST /documents/review|合同/租房文本核对，需显式transmitConfirmed=true；支持AbortSignal|

baseUrl=/api/v1时，完整路径为/api/v1/capabilities及/api/v1/documents/review。未配置调用抛not-configured且不会fetch。无自动重试；默认20秒超时。错误分为not-configured、invalid-input、http、network、timeout、aborted、invalid-response，不回显服务端原文或内部错误。HTTP错误可带安全的X-Request-ID。

请求示例（合成文字）：

```json
{"module":"contract","text":"合成材料：工作地点需要确认。","region":null,"confirmed":{"contractMonths":null}}
```

region和不确定参数应保留null，不能默认补成某个城市或零。text最多60000字符，confirmed最多30项，金额/数值必须有限；发送前需要产品层说明发送内容和目的地，并取得用户明确确认。不能只因配置了API就自动发送。

## 返回约定

响应统一为{requestId, data}，data/schemaVersion必须为1。

能力示例：

```json
{"requestId":"example-capabilities","data":{"schemaVersion":1,"supportedModules":["contract","rent"],"documentReview":true,"ocr":false,"rag":false,"agent":false}}
```

文档核对data含findings、questions、citations、limitations。准确类型见src/services/api-types.ts。finding.status只接受noted、needs-confirmation、missing-information；evidence为null或{start,end,text}，索引为原始JS字符串的零基UTF-16位置、end不含端点。客户端严格检查original.slice(start,end)===text，拒绝越界、伪造原文、未知sourceIds、重复ID和非HTTP(S)来源链接。缺少原文定位应返回null，不造位置。

citation必须含id/title/url/region/verifiedAt（YYYY-MM-DD）；完整的地区、人群、时效和政策真伪仍需后端资料维护与人工核验，类型检查不等于法律事实核验。findings和citations最多100项，questions最多50项，limitations最多20项。

## 后续真正接入时

- 服务端鉴权、参数校验、限流、超时、任务取消、模型密钥管理及资料版本必须补齐。
- UI提交时取消旧请求；输入已变化的旧结果不得覆盖当前材料。上传确认由产品界面完成，不能把transmitConfirmed直接写死为true后静默发送。
- 金额/税额由确定性公式，资格由维护的规则判断；不让模型自由编造。当前文档返回结构不包含可直接覆盖计算结果的金额。
- OCR、政策匹配、Agent任务接口尚未实现；后续分别定义协议与测试。不能将capability布尔值改成true就宣称接入完成。

8项API客户端测试使用合成数据和注入fetch，无真实外部请求；覆盖未配置零发送、能力结构、参数/同意校验、精确原文、伪造引用、HTTP/网络错误、超时及取消。
