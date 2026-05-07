import requests
import json

url = "http://localhost:5000/api/auth/login"
payload = {"email": "admin@test.com", "password": "admin"}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")
    if response.status_code == 500:
        # Try to extract error from HTML
        if 'text/html' in response.headers.get('Content-Type', ''):
            # Look for the error message in the HTML
            text = response.text
            if 'Traceback' in text:
                import re
                match = re.search(r'<pre class="traceback">(.*?)</pre>', text, re.DOTALL)
                if match:
                    print("\nError Traceback:")
                    # Strip HTML tags
                    traceback_text = re.sub(r'<[^>]+>', '', match.group(1))
                    print(traceback_text[:3000])
                else:
                    # Print first 2000 chars of the response
                    print("\nFirst 2000 chars of response:")
                    print(text[:2000])
    else:
        print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
