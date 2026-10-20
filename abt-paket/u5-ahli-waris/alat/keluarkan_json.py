# -*- coding: utf-8 -*-
"""Mengeluarkan seluruh definisi variabel (variabel.py + bukti.py) sebagai JSON ke stdout."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from variabel import VARIABEL
import bukti

V = sorted(VARIABEL + [bukti.bangun()], key=lambda x: x["no"])
sys.stdout.write(json.dumps(V))
