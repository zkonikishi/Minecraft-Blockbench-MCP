#!/usr/bin/env python3
"""Compile palette-indexed face grids into paint_face_features arguments."""
from __future__ import annotations
import argparse, json, re, sys
FACES = {"north","south","east","west","up","down"}; COLOR = re.compile(r"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$")
def compile_plan(spec):
    texture = spec.get("texture")
    if not isinstance(texture, str) or not texture: raise ValueError("texture must be a non-empty string")
    source_faces = spec.get("faces")
    if not isinstance(source_faces, list) or not source_faces: raise ValueError("faces must be a non-empty array")
    compiled=[]; seen=set()
    for index,item in enumerate(source_faces):
        if not isinstance(item,dict): raise ValueError(f"faces[{index}] must be an object")
        cube,face,rows,palette=item.get("cube"),item.get("face"),item.get("rows"),item.get("palette")
        if not isinstance(cube,str) or not cube: raise ValueError(f"faces[{index}].cube must be a non-empty string")
        if face not in FACES: raise ValueError(f"faces[{index}].face must be one of {sorted(FACES)}")
        key=(cube,face)
        if key in seen: raise ValueError(f"duplicate face plan for {cube}:{face}")
        seen.add(key)
        if not isinstance(rows,list) or not rows or not all(isinstance(row,str) for row in rows): raise ValueError(f"faces[{index}].rows must be a non-empty string array")
        width=len(rows[0])
        if width==0 or any(len(row)!=width for row in rows): raise ValueError(f"faces[{index}].rows must form a rectangle")
        if not isinstance(palette,dict) or not palette: raise ValueError(f"faces[{index}].palette must be a non-empty object")
        for symbol,color in palette.items():
            if not isinstance(symbol,str) or len(symbol)!=1: raise ValueError(f"faces[{index}] palette keys must be one character")
            if not isinstance(color,str) or not COLOR.fullmatch(color): raise ValueError(f"faces[{index}] invalid color for {symbol!r}: {color!r}")
        ops=[]
        for y,row in enumerate(rows):
            for x,symbol in enumerate(row):
                if symbol not in palette: raise ValueError(f"faces[{index}] symbol {symbol!r} is missing from palette")
                ops.append({"type":"rect","x":x,"y":y,"width":1,"height":1,"color":palette[symbol]})
        compiled.append({"cube":cube,"face":face,"ops":ops})
    return {"texture":texture,"faces":compiled}
def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("spec"); parser.add_argument("-o","--output"); args=parser.parse_args()
    try:
        with open(args.spec,"r",encoding="utf-8") as handle: result=compile_plan(json.load(handle))
        rendered=json.dumps(result,ensure_ascii=False,indent=2)+"\n"
        if args.output:
            with open(args.output,"w",encoding="utf-8") as handle: handle.write(rendered)
        else: sys.stdout.write(rendered)
        return 0
    except (OSError,ValueError,json.JSONDecodeError) as exc:
        print(f"compile_texture_plan: {exc}",file=sys.stderr); return 1
if __name__ == "__main__": raise SystemExit(main())
