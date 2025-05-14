#!/usr/bin/env python3
import spidev
import sys
import json

addr = int(sys.argv[1])
adc = spidev.SpiDev(4, 0)
adc.max_speed_hz = 4000000

def adc_setup_xmit(addr):
    return [0x80 | (1 << 5) | (0 << 4) | (0 << 3) | (addr),
            (0 << 4) | (0 << 3),
            0x00,
            0x00]

def adc_parse_result(data):
    maxval = 0x0fffffff
    out = {}
    out['eoc'] = data[0] >> 7 & 0x1
    out['sign'] = data[0] >> 5 & 0x1
    out['data'] = ((data[0] & 0x0f) << 24) + (data[1] << 16) + (data[2] << 8) + data[3]
    if not out['sign']:
        out['data'] = out['data'] ^ 0xfffffff
    out['normal'] = (out['data'] / (maxval * 1.0)) * 1.15 * 100
    return out

while True:
    res = adc_parse_result(adc.xfer2(adc_setup_xmit(addr)))
    if res['eoc'] == 0:
        break

print(json.dumps({'val': round(res['normal'], 2)}))