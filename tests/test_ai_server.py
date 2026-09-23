import importlib.util
import json
import os
from pathlib import Path
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
from functools import partial
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ai_server', ROOT / 'ai_server.py')
ai = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai)


class AITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ai.SanaHandler, directory=str(ROOT)))
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def fetch(self, path, body=None, origin=True):
        headers = {'Content-Type': 'application/json'}
        if origin:
            headers['Origin'] = self.url
        request = urllib.request.Request(self.url + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            with urllib.request.urlopen(request) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as r:
            return r.code, r.read()

    def test_static_assets(self):
        self.assertEqual(self.fetch('/')[0], 200)
        self.assertEqual(self.fetch('/ai-client.js')[0], 200)
        self.assertEqual(self.fetch('/experience.css')[0], 200)
        self.assertEqual(self.fetch('/projects.css')[0], 200)

    def test_private_files_blocked(self):
        for path in ('/.env', '/.git/config', '/ai_server.py', '/%2eenv', '/foo/../.env', '/docs/', '/.env.example'):
            self.assertEqual(self.fetch(path)[0], 404)

    def test_contact_removed(self):
        data = ai.clean_input({'mode': 'chat', 'message': 'Помоги', 'task': {'contact': 'private@example.com'}})
        self.assertNotIn('contact', data['task'])

    def test_invalid_input(self):
        for payload in ({}, {'mode': 'chat', 'message': ''}, {'mode': 'chat', 'message': 'x'*2001}, {'mode': 'questions', 'task': []}):
            self.assertRaises(ValueError, ai.clean_input, payload)

    def test_no_key(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
            self.assertFalse(json.loads(self.fetch('/api/ai/status')[1])['configured'])
            self.assertEqual(self.fetch('/api/ai', {'mode': 'chat', 'message': 'Помоги'})[0], 503)

    def test_origin_required(self):
        self.assertEqual(self.fetch('/api/ai', {'mode':'chat','message':'Помоги'}, origin=False)[0], 403)

    def test_proxy_success(self):
        result = {'source':'openai','message':'Уточните метрику приёмки.','questions':[]}
        with patch.dict(os.environ, {'OPENAI_API_KEY':'test-key'}), patch.object(ai, 'generate', return_value=result):
            status, body = self.fetch('/api/ai', {'mode':'chat','message':'Помоги'})
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body), result)

    def test_provider_failure_hides_details(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY':'test-key'}), patch.object(ai, 'generate', side_effect=RuntimeError('sensitive-provider-error')):
            status, body = self.fetch('/api/ai', {'mode':'chat','message':'Помоги'})
            self.assertEqual(status, 502)
            self.assertNotIn(b'sensitive-provider-error', body)

    def test_invalid_model_output(self):
        self.assertRaises(ValueError, ai.validate_output, {'message':'Совет','questions':[]}, 'questions')
        self.assertRaises(ValueError, ai.validate_output, {'message':'Совет','questions':[{'field':'fake','question':'?'}]}, 'chat')

    def test_generate_response_contract(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return json.dumps({'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':json.dumps({'message':'Совет','questions':[]})}]}]}).encode()
        with patch.dict(os.environ, {'OPENAI_API_KEY':'test-key'}), patch.object(ai.urllib.request,'urlopen',return_value=Response()) as call:
            result = ai.generate(ai.clean_input({'mode':'chat','message':'Помоги'}))
            self.assertEqual(result['source'], 'openai')
            body = json.loads(call.call_args.args[0].data)
            self.assertFalse(body['store'])
            self.assertEqual(body['text']['format']['type'], 'json_schema')


if __name__ == '__main__':
    unittest.main()
