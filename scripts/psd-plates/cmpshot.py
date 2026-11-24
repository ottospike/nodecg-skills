"""cmpshot.py <shot.png> <flat.png> <out.png> [x0 y0 x1 y1]  — diff a browser screenshot
(over bg 60) against the designer flat composited over the same grey."""
import sys, numpy as np
from PIL import Image
s=np.array(Image.open(sys.argv[1]).convert('RGB')).astype(float)
r=np.array(Image.open(sys.argv[2]).convert('RGBA')).astype(float)
ro=r[...,:3]*r[...,3:4]/255+60*(1-r[...,3:4]/255)
d=np.abs(s-ro).max(axis=2)
print('px>24', int((d>24).sum()), 'px>64', int((d>64).sum()), 'max', int(d.max()), 'opaque', int((r[...,3]>0).sum()))
if len(sys.argv)>4:
    x0,y0,x1,y1=map(int,sys.argv[4:8]); c=(slice(y0,y1),slice(x0,x1))
else:
    ys,xs=np.nonzero(r[...,3]>0); c=(slice(max(0,ys.min()-10),ys.max()+10),slice(max(0,xs.min()-10),xs.max()+10))
out=np.concatenate([ro[c],s[c],np.stack([(d[c]>24)*255]*3,-1)],axis=0).astype('uint8')
im=Image.fromarray(out)
if im.width>1400: im=im.resize((1400,int(im.height*1400/im.width)))
im.save(sys.argv[3])
