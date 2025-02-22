const db = new PouchDB('my_database');

function showAll() {
    return db.allDocs({ include_docs: true, descending: true }, function (err, doc) {
        console.log(doc.rows)
    });
}

function createTransaction({ name, amount, category, type }) {
    if (type === 'expense' && amount > 0) {
        amount = amount * -1;
    }

    const transaction = {
        _id: uniqID(),
        name: name,
        type: 'transaction',
        amount: amount,
        type_finance: type,
        date: new Date().toISOString(),
        category: category
    };
    return db.put(transaction, function callback(err, result) {
        if (!err) {
            console.log('Successfully posted a todo!');
        }
    });
}

function updateTransaction({ name, amount, category, type, id }) {

    if (type === 'expense' && amount > 0) {
        amount = amount * -1;
    }

    return db.get(id)
        .then(function (doc) {
            // Modify the document with new values
            doc.name = name;
            doc.amount = amount;
            doc.category = category;
            doc.type_finance = type;
            doc.date = new Date().toISOString();  // Update the date field

            // Put the updated document back into the database
            return db.put(doc);
        })
        .then(function (result) {
            console.log('Transaction updated successfully', result);
        })
        .catch(function (err) {
            console.error('Error updating transaction:', err);
        });
}

function createCategory({ name }) {
    const category = {
        _id: uniqID(),
        type: 'category',
        name: name,
    };

    return db.put(category)
}

async function listType({ type = 'category' }) {
    try {
        const result = await db.find({
            selector: { type: type }, // Filter by 'type' field
        });
        return result.docs
    } catch (err) {
        console.error('Error:', err);
    }
}

async function searchCategory({ name }) {
    try {
        const result = await db.find({
            selector: {
                type: 'category',
                name: name
            }, // Filter by 'type' field
        });
        console.log(result)
        return result.docs[0]
    } catch (err) {
        console.error('Error:', err);
    }
}

async function remove(id) {
    try {
        const doc = await db.get(id);
        const response = await db.remove(doc);
        console.log('Document deleted successfully:', response);
    } catch (err) {
        console.error('Error deleting document:', err);
    }
}

function uniqID() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

async function deleteAllDocuments() {
    try {
        const result = await db.allDocs({ include_docs: true });

        // Delete each document by its ID
        const deletePromises = result.rows.map(row => {
            return db.remove(row.doc);
        });

        // Wait for all deletions to complete
        await Promise.all(deletePromises);
        console.log('All documents deleted');
    } catch (error) {
        console.error('Error deleting documents:', error);
    }
}

// render category
async function renderCategory() {
    const list_category = await listType({ type: 'category' })
    const categoryInput = document.getElementById('category-list');
    categoryInput.innerHTML = '';
    list_category.forEach((category) => {
        const option = document.createElement('option');
        option.value = category.name;
        option.text = category.name;
        categoryInput.appendChild(option);
    });
}

// render transaction
async function renderTransaction() {
    const list = await listType({ type: 'transaction' })
    const container = document.getElementById('transaction-list');
    container.innerHTML = '';
    list.forEach((transaction) => {
        const row = document.createElement('tr');
        const class_value = transaction.amount < 0 ? 'text-danger' : 'text-success'
        row.classList.add(class_value);
        row.innerHTML = `
            <th scope="row">${transaction._id} 
                <button onclick="deleteRow('${transaction._id}')"> Delete </button>
                <button onclick="updateRow('${transaction._id}')"> Update </button>
            </th>
            <td>${transaction.name}</td>
            <td>${transaction.amount}</td>
            <td>${transaction.category}</td>
            <td>${transaction.type_finance}</td>
            <td>${transaction.date}</td>
        `
        container.appendChild(row);
    });
    updateChart(chart);
    renderTotalAmount();

}

// Handle delete row
function deleteRow(id) {
    remove(id)
        .then(() => {
            alert('Transaction Deleted')
            renderTransaction();
        })
}

function updateRow(id) {
    const transaction = db.get(id)
    transaction.then((doc) => {
        document.getElementById('transaction-id-input').value = doc._id
        document.getElementById('transaction-name-input').value = doc.name
        document.getElementById('transaction-amount-input').value = doc.amount
        document.getElementById('category-list').value = doc.category
        document.getElementById('type_finance-input').value = doc.type_finance
    })
}

// render chart
function renderChart() {
    const ctx = document.getElementById('myChart');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Moms', 'Listrik', 'Shophee'],
            datasets: [{
                label: '# of Votes',
                data: [100, 100, 2],
                backgroundColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 205, 86)'
                ],
                hoverOffset: 4
            }]
        },
    });

    return chart
}

async function updateChart(chart) {
    let list_category = await listType({ type: 'category' })
    list_category = list_category.map((category) => category.name)
    chart.data.labels = list_category

    let list_transaction = await listType({ type: 'transaction' })
    list_transaction = list_transaction.filter((transaction) => transaction.amount < 0)
    const result = _(list_transaction)
        .groupBy('category')  // Group by 'category'
        .mapValues(transactions =>
            _.sumBy(transactions, transaction => parseFloat(transaction.amount))  // Sum the amounts in each category
        )
        .value();

    const matchedResults = list_category.map(category => result[category] || 0);
    chart.data.datasets[0].data = matchedResults
    chart.update();
}

async function renderTotalAmount() {
    const totalAmount = document.getElementById('total-amount-label');
    const list_transaction = await listType({ type: 'transaction' })
    const total = _.sumBy(list_transaction, transaction => parseFloat(transaction.amount))
    totalAmount.innerText = Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(total) // format total
}

(async () => {
    // await deleteAllDocuments();

    window.chart = renderChart();

    const response = await db.createIndex({
        index: { fields: ['type', 'name'] }
    });

    renderCategory();
    renderTransaction();

    // handle create category
    const categorySubmit = document.getElementById('category-submit');
    categorySubmit.addEventListener('click', () => {
        const category = document.getElementById('category-name-input').value;
        createCategory({ name: category })
            .then(() => {
                alert('Category Created')
                renderCategory();
            })
    });

    // handle delete category
    const categoryDeleteSubmit = document.getElementById('category-delete-submit');
    categoryDeleteSubmit.addEventListener('click', async (e) => {
        const category = document.getElementById('category-name-input').value;
        const findCategory = await searchCategory({ name: category })
        remove(findCategory._id)
            .then(() => {
                alert('Category Deleted')
                renderCategory();
            })
    });

    // handle add transaction
    const transactionSubmit = document.getElementById('transaction-submit');
    transactionSubmit.addEventListener('click', () => {
        const name = document.getElementById('transaction-name-input').value;
        const amount = document.getElementById('transaction-amount-input').value;
        const type = document.getElementById('type_finance-input').value;
        const category = document.getElementById('category-list').value;
        createTransaction({ name, amount, category, type })
            .then(() => {
                alert('Transaction Created')
                renderTransaction();
            })
    });

    // handle save transaction
    const transactionSaveSubmit = document.getElementById('transaction-save-submit');
    transactionSaveSubmit.addEventListener('click', () => {
        const id = document.getElementById('transaction-id-input').value;
        const name = document.getElementById('transaction-name-input').value;
        const amount = document.getElementById('transaction-amount-input').value;
        const type = document.getElementById('type_finance-input').value;
        const category = document.getElementById('category-list').value;
        console.log({ name, amount, category, type, id })
        updateTransaction({ name, amount, category, type, id })
            .then(() => {
                alert('Transaction Updated')
                renderTransaction();
            })
    });

    // handle clear transaction
    const transactionClearSubmit = document.getElementById('transaction-clear-submit');
    transactionClearSubmit.addEventListener('click', () => {
        document.getElementById('transaction-name-input').value = '';
        document.getElementById('transaction-amount-input').value = '';
        document.getElementById('category-list').value = '';
        document.getElementById('type_finance-input').value = '';
    });

})()


