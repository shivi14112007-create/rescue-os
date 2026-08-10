import io

from PIL import Image
from fastapi.testclient import TestClient

from app.main import app


def test_analyze_image_endpoint_returns_analysis():
    client = TestClient(app)

    image_bytes = io.BytesIO()
    Image.new("RGB", (64, 64), color=(255, 0, 0)).save(image_bytes, format="JPEG")

    response = client.post(
        "/vision/analyze-image",
        files={"file": ("test.jpg", image_bytes.getvalue(), "image/jpeg")},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert "produce_type" in payload
    assert "quality_label" in payload
    assert isinstance(payload["produce_type"], str)
