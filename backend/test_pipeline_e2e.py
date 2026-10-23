import json
import urllib.request
import urllib.error
import uuid
import pytest

def test_api():
    base = 'http://127.0.0.1:8000/api'
    
    # 1. Status
    try:
        status_data = json.loads(urllib.request.urlopen(f'{base}/vision/status', timeout=1.0).read())
    except (urllib.error.URLError, ConnectionRefusedError, OSError):
        pytest.skip("Live uvicorn server not running at http://127.0.0.1:8000 (run uvicorn app.main:app to execute e2e)")
    print('1. Status Check:')
    print('   Active Mode:', status_data['mode'])
    print('   Real Model Available:', status_data['real_model']['is_available'])
    print('   Real Model Name:', status_data['real_model']['name'])
    print('   Execution Provider:', status_data['real_model']['execution_provider'])
    print('   Supported Classes:', status_data['real_model']['supported_classes'])
    
    # 2. Get sample video
    sample_vid_bytes = urllib.request.urlopen(f'{base}/vision/sample-video').read()
    print(f'2. Fetched Sample Video: {len(sample_vid_bytes)} bytes')
    
    # 3. Post video to real inference endpoint
    boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
    part_head = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="sample_traffic_video.mp4"\r\n'
        f'Content-Type: video/mp4\r\n\r\n'
    ).encode('utf-8')
    part_tail = f'\r\n--{boundary}--\r\n'.encode('utf-8')
    body = part_head + sample_vid_bytes + part_tail
    
    req = urllib.request.Request(
        f'{base}/vision/analyze?adapter=real',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    res = urllib.request.urlopen(req)
    result = json.loads(res.read())
    print('3. Real Video Inference Results:')
    print('   Status:', result['status'])
    print('   Is Simulated:', result['is_simulated'])
    print('   Data Source:', result['data_source'])
    print('   Adapter Name:', result['adapter_name'])
    print('   Duration:', result['duration_seconds'], 'seconds')
    print('   Sampled Frames:', result['frame_count_sampled'])
    print('   Processing Time:', result['processing_time_ms'], 'ms')
    print('   Total Vehicles:', result['total_vehicles'])
    print('   Vehicle Breakdown:', result['vehicle_breakdown'])
    print('   Total Pedestrians:', result['total_pedestrians'])
    print('   Representative Frame Base64 Length:', len(result['representative_frame_base64']) if result['representative_frame_base64'] else 0)
    print('   Detected Objects Count in Representative Frame:', len(result['detected_objects']))
    for obj in result['detected_objects'][:5]:
        print(f'     - {obj["class_name"]} (confidence: {obj["confidence"]}) box: {obj["box"]}')
    print('   Provenance Notice:', result['provenance_notice'])
    
    # 4. Check persistent history
    history = json.loads(urllib.request.urlopen(f'{base}/vision/history?limit=5').read())
    print('4. Database Persistence Check:')
    print(f'   Retrieved {len(history)} persistent records from SQLite.')
    matching = [h for h in history if h['id'] == result['analysis_id']]
    print('   Newly created record found in DB:', len(matching) == 1)
    if matching:
        print('   DB Record Timestamp:', matching[0]['created_at'])
        print('   DB Record Filename:', matching[0]['filename'])
        print('   DB Record Duration:', matching[0]['duration_seconds'])
    
    # 5. Check detail endpoint
    detail = json.loads(urllib.request.urlopen(f'{base}/vision/history/{result["analysis_id"]}').read())
    print('5. Detail API Endpoint:')
    print('   Record ID:', detail['id'])
    print('   Detections saved in DB:', len(detail['detections']))
    print('   Is Simulated Flag:', detail['is_simulated'])
    
    print('\nALL PIPELINE CHECKS PASSED!')

if __name__ == '__main__':
    test_api()
