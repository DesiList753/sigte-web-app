import json
import time
import urllib.request
import urllib.error

def run_tests():
    with open("qa-tests/api-tests.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("item", [])
    print("\n" + "=" * 70)
    print(" S.I.G.T.E. - API INTEGRATION TEST SUITE (NEWMAN ENGINE / QA)")
    print("=" * 70)

    total = len(items)
    passed = 0
    failed = 0

    for idx, item in enumerate(items, 1):
        name = item.get("name", f"Test {idx}")
        req = item.get("request", {})
        url = req.get("url", {}).get("raw", "")
        method = req.get("method", "GET")
        body = req.get("body", {}).get("raw", None)
        
        headers = {}
        for h in req.get("header", []):
            headers[h["key"]] = h["value"]

        start = time.time()
        status_code = None
        error_msg = None

        try:
            data_bytes = body.encode("utf-8") if body else None
            request = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
            with urllib.request.urlopen(request, timeout=10) as response:
                status_code = response.getcode()
        except urllib.error.HTTPError as e:
            status_code = e.code
        except Exception as e:
            error_msg = str(e)

        elapsed = round((time.time() - start) * 1000, 2)

        # Validaciones esperadas
        is_pass = False
        if "CP-AUTH-01" in name and status_code == 200:
            is_pass = True
        elif "CP-AUTH-02" in name and status_code == 401:
            is_pass = True
        elif "CP-AFO-01" in name and status_code == 200:
            is_pass = True

        if is_pass:
            passed += 1
            badge = "[ PASS ]"
        else:
            failed += 1
            badge = "[ FAIL ]"

        print(f"{badge} {name}")
        print(f"         URL: {method} {url} | Status: {status_code} | Latencia: {elapsed} ms\n")

    print("=" * 70)
    print(f" RESUMEN: Total: {total} | Aprobados: {passed} | Fallidos: {failed} | Exito: {(passed/total)*100:.1f}%")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    run_tests()