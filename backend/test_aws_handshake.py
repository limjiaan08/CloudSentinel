import requests

url = "http://127.0.0.1:5000/api/connection/test-aws"

payload = {
    "access_key": None,
    "secret_key": "oD8/NmTiBhUzudm1ekVRJpQJpybNZObz4ixPeBnr",
    "region": "ap-southeast-2"
}

print("TESTING AWS HANDSHAKE")

try:
    response = requests.post(url, json=payload)
    result = response.json()

    print(f"Status code: {response.status_code}")

    if response.status_code == 200:
        print("connection verified")
        print(f"account ID: {result['data']['account_id']}")
    else:
        print("connection failed")
        print(f"Error: {result.get('message')}")

except Exception as e:
    print(f"Internal Error: {e}")
