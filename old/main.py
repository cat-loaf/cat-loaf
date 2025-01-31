from flask import Flask,send_from_directory
app = Flask(__name__)

@app.route('/')
def index():
    return send_from_directory('','index.html')

@app.route('/1')
def page1():
    return send_from_directory('','pages/page1.html')

    
@app.route('/2')
def page2():
    return send_from_directory('','pages/page2.html')


app.run()